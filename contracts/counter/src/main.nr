// docs:start:setup
use dep::aztec::macros::aztec;

#[aztec]
pub contract Counter {
    // docs:end:setup
    // docs:start:imports
    use aztec::macros::{functions::{initializer, private, utility}, storage::storage};
    use aztec::prelude::{AztecAddress, Map};
    use aztec::protocol_types::traits::{FromField, ToField};
    use easy_private_state::EasyPrivateUint;
    use value_note::{balance_utils, value_note::ValueNote};
    // docs:end:imports

    // docs:start:storage_struct
    #[storage]
    struct Storage<Context> {
        counters: Map<AztecAddress, EasyPrivateUint<Context>, Context>,
    }
    // docs:end:storage_struct

    // docs:start:constructor
    #[initializer]
    #[private]
    // We can name our initializer anything we want as long as it's marked as aztec(initializer)
    fn initialize(headstart: u64, owner: AztecAddress) {
        let counters = storage.counters;
        counters.at(owner).add(headstart, owner, context.msg_sender());
    }
    // docs:end:constructor

    // docs:start:increment
    #[private]
    fn increment(owner: AztecAddress, sender: AztecAddress) {
        unsafe {
            dep::aztec::oracle::debug_log::debug_log_format(
                "Incrementing counter for owner {0}",
                [owner.to_field()],
            );
        }
        let counters = storage.counters;
        counters.at(owner).add(1, owner, sender);
    }
    // docs:end:increment

    #[private]
    fn increment_twice(owner: AztecAddress, sender: AztecAddress) {
        unsafe {
            dep::aztec::oracle::debug_log::debug_log_format(
                "Incrementing counter twice for owner {0}",
                [owner.to_field()],
            );
        }
        let counters = storage.counters;
        counters.at(owner).add(1, owner, sender);
        counters.at(owner).add(1, owner, sender);
    }

    #[private]
    fn increment_and_decrement(owner: AztecAddress, sender: AztecAddress) {
        unsafe {
            dep::aztec::oracle::debug_log::debug_log_format(
                "Incrementing and decrementing counter for owner {0}",
                [owner.to_field()],
            );
        }
        let counters = storage.counters;
        counters.at(owner).add(1, owner, sender);
        counters.at(owner).sub(1, owner, sender);
    }

    #[private]
    fn decrement(owner: AztecAddress, sender: AztecAddress) {
        unsafe {
            dep::aztec::oracle::debug_log::debug_log_format(
                "Decrementing counter for owner {0}",
                [owner.to_field()],
            );
        }
        let counters = storage.counters;
        counters.at(owner).sub(1, owner, sender);
    }

    // docs:start:get_counter
    #[utility]
    unconstrained fn get_counter(owner: AztecAddress) -> Field {
        let counters = storage.counters;
        balance_utils::get_balance(counters.at(owner).set)
    }    
}