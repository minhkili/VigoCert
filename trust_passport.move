// ============================================================
// VigoCert Trust Passport — Aptos Move Smart Contract
// Network: Testnet (module address = your deployed address)
// ============================================================
//
// Deploy command (testnet):
//   aptos move publish --profile testnet --named-addresses vigocert=<YOUR_ADDR>
//
// ============================================================

module vigocert::trust_passport {
    use std::string::{Self, String};
    use std::signer;
    use std::vector;
    use aptos_framework::timestamp;
    use aptos_framework::event;
    use aptos_framework::account;

    // ─── Error Codes ─────────────────────────────────────────────────────────

    const E_NOT_AUTHORIZED:     u64 = 1;
    const E_PASSPORT_EXISTS:    u64 = 2;
    const E_PASSPORT_NOT_FOUND: u64 = 3;
    const E_INVALID_COMMODITY:  u64 = 4;
    const E_REVOKED:            u64 = 5;

    // ─── Commodity Types ─────────────────────────────────────────────────────

    const COMMODITY_COFFEE:   u8 = 1;
    const COMMODITY_RUBBER:   u8 = 2;
    const COMMODITY_WOOD:     u8 = 3;
    const COMMODITY_COCOA:    u8 = 4;
    const COMMODITY_PALM_OIL: u8 = 5;
    const COMMODITY_SOY:      u8 = 6;
    const COMMODITY_CATTLE:   u8 = 7;

    // ─── Structs ──────────────────────────────────────────────────────────────

    /// Core Trust Passport record — immutable after minting
    struct TrustPassport has store, drop, copy {
        passport_id:    String,   // Unique ID: "VC-{timestamp}-{farmer_id}"
        farmer_id:      String,   // Farmer wallet or internal ID
        commodity:      u8,       // Commodity type enum
        photo_cid:      String,   // Shelby CID for harvest photo
        package_cid:    String,   // Shelby CID for full evidence package JSON
        sha256:         String,   // SHA-256 of original photo (integrity)
        gps_lat:        u64,      // Latitude * 1e6 (fixed point, no floats in Move)
        gps_lng:        u64,      // Longitude * 1e6
        plot_area_ha:   u64,      // Plot area in hectares * 100
        minted_at:      u64,      // Aptos timestamp (microseconds)
        mainnet_anchor: String,   // Public Vigo Ledger Mainnet TX hash (after daily bridge)
        status:         u8,       // 0=pending, 1=verified, 2=revoked
    }

    /// Per-exporter storage: holds all their TrustPassports
    struct PassportRegistry has key {
        passports:      vector<TrustPassport>,
        total_minted:   u64,
        mint_events:    event::EventHandle<MintEvent>,
        verify_events:  event::EventHandle<VerifyEvent>,
    }

    /// Global registry (owned by vigocert admin)
    struct GlobalConfig has key {
        admin:          address,
        total_passports: u64,
        paused:         bool,
    }

    // ─── Events ───────────────────────────────────────────────────────────────

    struct MintEvent has drop, store {
        passport_id: String,
        farmer_id:   String,
        commodity:   u8,
        photo_cid:   String,
        minted_at:   u64,
    }

    struct VerifyEvent has drop, store {
        passport_id: String,
        verified_by: address,
        verified_at: u64,
    }

    // ─── Init ──────────────────────────────────────────────────────────────────

    /// Called once by VigoCert admin to initialize global config
    public entry fun initialize(admin: &signer) {
        let admin_addr = signer::address_of(admin);
        move_to(admin, GlobalConfig {
            admin: admin_addr,
            total_passports: 0,
            paused: false,
        });
    }

    /// Called by each exporter to initialize their registry
    public entry fun init_registry(exporter: &signer) {
        let addr = signer::address_of(exporter);
        assert!(!exists<PassportRegistry>(addr), E_PASSPORT_EXISTS);
        move_to(exporter, PassportRegistry {
            passports: vector::empty(),
            total_minted: 0,
            mint_events: account::new_event_handle<MintEvent>(exporter),
            verify_events: account::new_event_handle<VerifyEvent>(exporter),
        });
    }

    // ─── Mint Trust Passport ──────────────────────────────────────────────────

    /// Mint a new Trust Passport after Shelby upload succeeds.
    /// Called by exporter (factory/company), on behalf of their farmer.
    public entry fun mint_passport(
        exporter:    &signer,
        passport_id: String,
        farmer_id:   String,
        commodity:   u8,
        photo_cid:   String,
        package_cid: String,
        sha256:      String,
        gps_lat:     u64,    // e.g., 10.823099 → 10823099
        gps_lng:     u64,    // e.g., 106.629664 → 106629664
        plot_area_ha: u64,   // e.g., 2.5 ha → 250
    ) acquires PassportRegistry {
        let addr = signer::address_of(exporter);
        assert!(exists<PassportRegistry>(addr), E_PASSPORT_NOT_FOUND);
        assert!(commodity >= 1 && commodity <= 7, E_INVALID_COMMODITY);

        let registry = borrow_global_mut<PassportRegistry>(addr);
        let now = timestamp::now_microseconds();

        let passport = TrustPassport {
            passport_id,
            farmer_id,
            commodity,
            photo_cid,
            package_cid,
            sha256,
            gps_lat,
            gps_lng,
            plot_area_ha,
            minted_at: now,
            mainnet_anchor: string::utf8(b"pending"),  // Updated by daily bridge
            status: 0,  // pending
        };

        event::emit_event(&mut registry.mint_events, MintEvent {
            passport_id: passport.passport_id,
            farmer_id:   passport.farmer_id,
            commodity:   passport.commodity,
            photo_cid:   passport.photo_cid,
            minted_at:   now,
        });

        vector::push_back(&mut registry.passports, passport);
        registry.total_minted = registry.total_minted + 1;
    }

    // ─── Anchor to Mainnet ────────────────────────────────────────────────────

    /// Called by VigoCert daily bridge service to update mainnet anchor TX
    public entry fun anchor_to_mainnet(
        admin:       &signer,
        exporter:    address,
        passport_id: String,
        mainnet_tx:  String,
    ) acquires PassportRegistry, GlobalConfig {
        let admin_addr = signer::address_of(admin);
        let config = borrow_global<GlobalConfig>(@vigocert);
        assert!(admin_addr == config.admin, E_NOT_AUTHORIZED);

        let registry = borrow_global_mut<PassportRegistry>(exporter);
        let len = vector::length(&registry.passports);
        let i = 0;
        while (i < len) {
            let passport = vector::borrow_mut(&mut registry.passports, i);
            if (passport.passport_id == passport_id) {
                passport.mainnet_anchor = mainnet_tx;
                passport.status = 1;  // verified
                break
            };
            i = i + 1;
        };
    }

    // ─── View Functions ───────────────────────────────────────────────────────

    #[view]
    public fun get_passport(
        exporter:    address,
        passport_id: String,
    ): (String, String, u8, String, String, u64, u8) acquires PassportRegistry {
        let registry = borrow_global<PassportRegistry>(exporter);
        let len = vector::length(&registry.passports);
        let i = 0;
        while (i < len) {
            let p = vector::borrow(&registry.passports, i);
            if (p.passport_id == passport_id) {
                return (
                    p.photo_cid,
                    p.package_cid,
                    p.commodity,
                    p.sha256,
                    p.mainnet_anchor,
                    p.minted_at,
                    p.status
                )
            };
            i = i + 1;
        };
        abort E_PASSPORT_NOT_FOUND
    }

    #[view]
    public fun get_total_minted(exporter: address): u64 acquires PassportRegistry {
        borrow_global<PassportRegistry>(exporter).total_minted
    }
}
