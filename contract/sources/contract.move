module project_contract::contract {
    use std::string::String;
    use std::signer;
    use std::string;
    use std::vector;
    use aptos_framework::account;
    use aptos_framework::event;
    use aptos_framework::coin;
    use aptos_framework::timestamp;
    use aptos_std::type_info::{Self, TypeInfo};

    // Error codes
    const E_NOT_AUTHORIZED: u64 = 1;
    const E_NOT_INITIALIZED: u64 = 2;
    const E_ALREADY_INITIALIZED: u64 = 3;
    const E_INVALID_AMOUNT: u64 = 4;
    const E_INVALID_ADDRESS: u64 = 5;
    const E_INSUFFICIENT_BALANCE: u64 = 6;
    const E_SELF_RECOVERY_NOT_ALLOWED: u64 = 7;
    const E_REQUEST_NOT_FOUND: u64 = 8;
    const E_REQUEST_EXPIRED: u64 = 9;
    const E_REQUEST_ALREADY_COMPLETED: u64 = 10;
    const E_MAX_REQUESTS_REACHED: u64 = 11;
    const E_INVALID_COIN_TYPE: u64 = 12;
    const E_DUPLICATE_REQUEST: u64 = 13;
    
    // Constants
    const MAX_REQUESTS_PER_ACCOUNT: u64 = 10;
    const REQUEST_EXPIRATION_TIME: u64 = 86400000000; // 24 hours in microseconds

    /// Store message data
    struct MessageHolder has key {
        message: String,
        message_change_events: event::EventHandle<MessageChangeEvent>,
    }

    /// Message change event
    struct MessageChangeEvent has drop, store {
        from_message: String,
        to_message: String,
    }

    // Event for token recovery request
    struct RecoveryRequestEvent has drop, store {
        from_address: address,
        to_address: address,
        amount: u64,
        timestamp: u64,
    }

    // Event for token recovery completion
    struct RecoveryCompletedEvent has drop, store {
        from_address: address,
        to_address: address,
        amount: u64,
        timestamp: u64,
    }

    // Status for recovery requests
    struct RequestStatus has copy, drop, store {
        is_completed: bool,
        completion_time: u64,
    }

    // Recovery request structure
    struct RecoveryRequest has store, drop {
        from_address: address,
        to_address: address,
        amount: u64,
        timestamp: u64,
        coin_type: TypeInfo,
        status: RequestStatus,
    }

    // Resource to store recovery requests
    struct RecoveryStore has key {
        requests: vector<RecoveryRequest>,
        request_events: event::EventHandle<RecoveryRequestEvent>,
        complete_events: event::EventHandle<RecoveryCompletedEvent>,
        total_recovered_amount: u64,
        last_request_timestamp: u64,
    }

    /// Helper function to clean up expired requests
    fun cleanup_expired_requests(store: &mut RecoveryStore) {
        let current_time = timestamp::now_microseconds();
        let i = 0;
        let len = vector::length(&store.requests);
        
        while (i < len) {
            let request = vector::borrow(&store.requests, i);
            if (!request.status.is_completed && 
                (current_time - request.timestamp) > REQUEST_EXPIRATION_TIME) {
                vector::remove(&mut store.requests, i);
                len = len - 1;
            } else {
                i = i + 1;
            }
        }
    }

    /// Initialize contract resources
    fun init_module(account: &signer) {
        // Initialize message board only if not already initialized
        if (!exists<MessageHolder>(signer::address_of(account))) {
            move_to(account, MessageHolder {
                message: string::utf8(b""),
                message_change_events: account::new_event_handle<MessageChangeEvent>(account),
            });
        };
    }

    /// Initialize for testing only
    public entry fun init_module_for_test(account: &signer) {
        init_module(account);
    }

    /// Check if account has message holder
    #[view]
    public fun has_message_holder(addr: address): bool {
        exists<MessageHolder>(addr)
    }

    /// Initialize the recovery store for an account with improved state handling
    public entry fun initialize_recovery(account: &signer) {
        let addr = signer::address_of(account);
        // Check if account exists
        assert!(account::exists_at(addr), E_NOT_INITIALIZED);
        
        // Only initialize if not already initialized
        if (!exists<RecoveryStore>(addr)) {
            move_to(account, RecoveryStore {
                requests: vector::empty(),
                request_events: account::new_event_handle<RecoveryRequestEvent>(account),
                complete_events: account::new_event_handle<RecoveryCompletedEvent>(account),
                total_recovered_amount: 0,
                last_request_timestamp: timestamp::now_microseconds(),
            });
        };
    }

    /// Check if account has recovery store
    #[view]
    public fun has_recovery_store(addr: address): bool {
        exists<RecoveryStore>(addr)
    }

    /// Update the message stored in the message holder
    public entry fun post_message(account: &signer, message: String) acquires MessageHolder {
        let addr = signer::address_of(account);
        assert!(exists<MessageHolder>(addr), E_NOT_INITIALIZED);
        
        let message_holder = borrow_global_mut<MessageHolder>(addr);
        let from_message = message_holder.message;
        message_holder.message = message;

        event::emit_event(&mut message_holder.message_change_events, MessageChangeEvent {
            from_message,
            to_message: message,
        });
    }

    /// Get the message stored in the message holder
    #[view]
    public fun get_message_content(addr: address): String acquires MessageHolder {
        assert!(exists<MessageHolder>(addr), E_NOT_INITIALIZED);
        let message_holder = borrow_global<MessageHolder>(addr);
        if (string::length(&message_holder.message) == 0) {
            string::utf8(b"No message yet")
        } else {
            message_holder.message
        }
    }

    /// Request token recovery with enhanced validation, expiration, and limits
    public entry fun request_recovery<CoinType>(
        account: &signer,
        to_address: address,
        amount: u64,
    ) acquires RecoveryStore {
        let from_address = signer::address_of(account);
        
        // Validate basic conditions
        assert!(exists<RecoveryStore>(from_address), E_NOT_INITIALIZED);
        assert!(amount > 0, E_INVALID_AMOUNT);
        assert!(from_address != to_address, E_SELF_RECOVERY_NOT_ALLOWED);
        assert!(account::exists_at(to_address), E_INVALID_ADDRESS);
        
        // Check if sender has coin account and sufficient balance
        assert!(coin::is_account_registered<CoinType>(from_address), E_INVALID_COIN_TYPE);
        assert!(coin::balance<CoinType>(from_address) >= amount, E_INSUFFICIENT_BALANCE);

        let recovery_store = borrow_global_mut<RecoveryStore>(from_address);
        let current_time = timestamp::now_microseconds();

        // Clean up expired requests
        let i = 0;
        let len = vector::length(&recovery_store.requests);
        while (i < len) {
            let request = vector::borrow(&recovery_store.requests, i);
            if (!request.status.is_completed && 
                (current_time - request.timestamp) > REQUEST_EXPIRATION_TIME) {
                vector::remove(&mut recovery_store.requests, i);
                len = len - 1;
            } else {
                i = i + 1;
            }
        };

        // Check request limit after cleanup
        assert!(vector::length(&recovery_store.requests) < MAX_REQUESTS_PER_ACCOUNT, E_MAX_REQUESTS_REACHED);

        // Check for duplicate requests
        let i = 0;
        let len = vector::length(&recovery_store.requests);
        while (i < len) {
            let existing_request = vector::borrow(&recovery_store.requests, i);
            assert!(!(existing_request.to_address == to_address && 
                     existing_request.amount == amount && 
                     !existing_request.status.is_completed), 
                   E_DUPLICATE_REQUEST);
            i = i + 1;
        };

        // Validate coin type
        assert!(coin::is_account_registered<CoinType>(to_address), E_INVALID_COIN_TYPE);

        // Create request with status tracking
        let request = RecoveryRequest {
            from_address,
            to_address,
            amount,
            timestamp: current_time,
            coin_type: type_info::type_of<CoinType>(),
            status: RequestStatus {
                is_completed: false,
                completion_time: 0,
            },
        };

        vector::push_back(&mut recovery_store.requests, request);
        recovery_store.last_request_timestamp = current_time;

        // Emit event with detailed information
        event::emit_event(&mut recovery_store.request_events, RecoveryRequestEvent {
            from_address,
            to_address,
            amount,
            timestamp: current_time,
        });
    }

    /// Execute token recovery with enhanced security and tracking
    public entry fun execute_recovery<CoinType>(
        admin: &signer,
        from_address: address,
        to_address: address,
        amount: u64,
    ) acquires RecoveryStore {
        let admin_addr = signer::address_of(admin);
        
        // Validate admin and request
        assert!(admin_addr == @project_contract, E_NOT_AUTHORIZED);
        assert!(exists<RecoveryStore>(from_address), E_NOT_INITIALIZED);
        assert!(account::exists_at(to_address), E_INVALID_ADDRESS);
        
        let recovery_store = borrow_global_mut<RecoveryStore>(from_address);
        let current_time = timestamp::now_microseconds();

        // Clean up expired requests first
        let i = 0;
        let len = vector::length(&recovery_store.requests);
        while (i < len) {
            let request = vector::borrow(&recovery_store.requests, i);
            if (!request.status.is_completed && 
                (current_time - request.timestamp) > REQUEST_EXPIRATION_TIME) {
                vector::remove(&mut recovery_store.requests, i);
                len = len - 1;
            } else {
                i = i + 1;
            }
        };

        // Verify request exists and matches
        let found = false;
        i = 0;
        len = vector::length(&recovery_store.requests);
        
        while (i < len) {
            let request = vector::borrow_mut(&mut recovery_store.requests, i);
            if (request.to_address == to_address && 
                request.amount == amount && 
                type_info::type_of<CoinType>() == request.coin_type) {
                
                // Check if request is already completed
                assert!(!request.status.is_completed, E_REQUEST_ALREADY_COMPLETED);
                
                // Check if request has expired
                assert!((current_time - request.timestamp) <= REQUEST_EXPIRATION_TIME, E_REQUEST_EXPIRED);
                
                found = true;
                
                // Update request status
                request.status = RequestStatus {
                    is_completed: true,
                    completion_time: current_time,
                };
                break;
            };
            i = i + 1;
        };
        
        assert!(found, E_REQUEST_NOT_FOUND);

        // Validate coin registration and transfer tokens with safety checks
        assert!(coin::is_account_registered<CoinType>(to_address), E_INVALID_COIN_TYPE);
        assert!(coin::balance<CoinType>(admin_addr) >= amount, E_INSUFFICIENT_BALANCE);
        let coins = coin::withdraw<CoinType>(admin, amount);
        
        // Auto-registration is not needed as we check earlier
        
        coin::deposit(to_address, coins);

        // Update recovery store stats
        recovery_store.total_recovered_amount = recovery_store.total_recovered_amount + amount;

        // Emit completion event with full details
        event::emit_event(&mut recovery_store.complete_events, RecoveryCompletedEvent {
            from_address,
            to_address,
            amount,
            timestamp: current_time,
        });
    }

    /// Get all recovery requests basic info
    #[view]
    public fun get_recovery_requests(addr: address): (vector<address>, vector<address>, vector<u64>, vector<u64>) acquires RecoveryStore {
        assert!(exists<RecoveryStore>(addr), E_NOT_INITIALIZED);
        let store = borrow_global<RecoveryStore>(addr);
        let requests = &store.requests;
        let len = vector::length(requests);
        let from_addresses = vector::empty<address>();
        let to_addresses = vector::empty<address>();
        let amounts = vector::empty<u64>();
        let timestamps = vector::empty<u64>();
        
        let i = 0;
        while (i < len) {
            let request = vector::borrow(requests, i);
            vector::push_back(&mut from_addresses, request.from_address);
            vector::push_back(&mut to_addresses, request.to_address);
            vector::push_back(&mut amounts, request.amount);
            vector::push_back(&mut timestamps, request.timestamp);
            i = i + 1;
        };
        
        (from_addresses, to_addresses, amounts, timestamps)
    }

    /// Get all recovery requests with detailed status and cleanup
    #[view]
    public fun get_recovery_requests_with_status(addr: address): (vector<address>, vector<address>, vector<u64>, vector<u64>, vector<bool>, vector<u64>) acquires RecoveryStore {
        assert!(exists<RecoveryStore>(addr), E_NOT_INITIALIZED);
        let store = borrow_global_mut<RecoveryStore>(addr);
        cleanup_expired_requests(store);
        let requests = &store.requests;
        let len = vector::length(requests);
        let from_addresses = vector::empty<address>();
        let to_addresses = vector::empty<address>();
        let amounts = vector::empty<u64>();
        let timestamps = vector::empty<u64>();
        let completed = vector::empty<bool>();
        let completion_times = vector::empty<u64>();
        
        let i = 0;
        while (i < len) {
            let request = vector::borrow(requests, i);
            vector::push_back(&mut from_addresses, request.from_address);
            vector::push_back(&mut to_addresses, request.to_address);
            vector::push_back(&mut amounts, request.amount);
            vector::push_back(&mut timestamps, request.timestamp);
            vector::push_back(&mut completed, request.status.is_completed);
            vector::push_back(&mut completion_times, request.status.completion_time);
            i = i + 1;
        };
        
        (from_addresses, to_addresses, amounts, timestamps, completed, completion_times)
    }

    /// Get recovery store statistics
    #[view]
    public fun get_recovery_stats(addr: address): (u64, u64) acquires RecoveryStore {
        assert!(exists<RecoveryStore>(addr), E_NOT_INITIALIZED);
        let store = borrow_global<RecoveryStore>(addr);
        (store.total_recovered_amount, store.last_request_timestamp)
    }

    /// Cancel a recovery request
    public entry fun cancel_recovery<CoinType>(
        account: &signer,
        to_address: address,
        amount: u64,
    ) acquires RecoveryStore {
        let from_address = signer::address_of(account);
        assert!(exists<RecoveryStore>(from_address), E_NOT_INITIALIZED);
        
        let recovery_store = borrow_global_mut<RecoveryStore>(from_address);
        let i = 0;
        let len = vector::length(&recovery_store.requests);
        let found = false;
        
        while (i < len) {
            let request = vector::borrow(&recovery_store.requests, i);
            if (request.to_address == to_address && 
                request.amount == amount && 
                type_info::type_of<CoinType>() == request.coin_type &&
                !request.status.is_completed) {
                found = true;
                vector::remove(&mut recovery_store.requests, i);
                break;
            };
            i = i + 1;
        };
        
        assert!(found, E_REQUEST_NOT_FOUND);
    }
}
