// Generated from the connected NIRDHOOM Supabase project. Regenerate after schema changes.
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      ai_conversations: {
        Row: {
          created_at: string
          field_id: string | null
          id: string
          message: string
          profile_id: string
          role: string
        }
        Insert: {
          created_at?: string
          field_id?: string | null
          id?: string
          message: string
          profile_id: string
          role: string
        }
        Update: {
          created_at?: string
          field_id?: string | null
          id?: string
          message?: string
          profile_id?: string
          role?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_conversations_field_id_fkey"
            columns: ["field_id"]
            isOneToOne: false
            referencedRelation: "fields"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_conversations_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_events: {
        Row: {
          action: string
          actor_id: string | null
          after_state: Json | null
          before_state: Json | null
          entity_id: string | null
          entity_type: string
          id: string
          occurred_at: string
          request_id: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          after_state?: Json | null
          before_state?: Json | null
          entity_id?: string | null
          entity_type: string
          id?: string
          occurred_at?: string
          request_id?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          after_state?: Json | null
          before_state?: Json | null
          entity_id?: string | null
          entity_type?: string
          id?: string
          occurred_at?: string
          request_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_events_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_log: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          entity_id: string | null
          entity_type: string
          id: string
          metadata: Json
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type: string
          id?: string
          metadata?: Json
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string
          id?: string
          metadata?: Json
        }
        Relationships: [
          {
            foreignKeyName: "audit_log_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      bookings: {
        Row: {
          accepted_at: string | null
          assigned_at: string | null
          cancelled_at: string | null
          created_at: string
          field_id: string
          guaranteed_by_date: string | null
          id: string
          machine_id: string | null
          reservation_state: string
          penalty_amount: number
          pricing_band: string | null
          quote_metadata: Json
          quoted_amount: number
          rate_per_acre: number
          requested_date: string
          status: string
          updated_at: string
        }
        Insert: {
          accepted_at?: string | null
          assigned_at?: string | null
          cancelled_at?: string | null
          created_at?: string
          field_id: string
          guaranteed_by_date?: string | null
          id?: string
          machine_id?: string | null
          reservation_state?: string
          penalty_amount?: number
          pricing_band?: string | null
          quote_metadata?: Json
          quoted_amount: number
          rate_per_acre: number
          requested_date: string
          status?: string
          updated_at?: string
        }
        Update: {
          accepted_at?: string | null
          assigned_at?: string | null
          cancelled_at?: string | null
          created_at?: string
          field_id?: string
          guaranteed_by_date?: string | null
          id?: string
          machine_id?: string | null
          reservation_state?: string
          penalty_amount?: number
          pricing_band?: string | null
          quote_metadata?: Json
          quoted_amount?: number
          rate_per_acre?: number
          requested_date?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bookings_field_id_fkey"
            columns: ["field_id"]
            isOneToOne: false
            referencedRelation: "fields"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_machine_id_fkey"
            columns: ["machine_id"]
            isOneToOne: false
            referencedRelation: "machines"
            referencedColumns: ["id"]
          },
        ]
      }
      buyer_contracts: {
        Row: {
          buyer_id: string
          contract_ref: string
          created_at: string
          id: string
          max_tonnes: number | null
          min_tonnes: number | null
          moisture_ceiling: number | null
          price_per_tonne: number
          status: string
          terms: Json
          valid_from: string
          valid_until: string | null
        }
        Insert: {
          buyer_id: string
          contract_ref: string
          created_at?: string
          id?: string
          max_tonnes?: number | null
          min_tonnes?: number | null
          moisture_ceiling?: number | null
          price_per_tonne: number
          status?: string
          terms?: Json
          valid_from: string
          valid_until?: string | null
        }
        Update: {
          buyer_id?: string
          contract_ref?: string
          created_at?: string
          id?: string
          max_tonnes?: number | null
          min_tonnes?: number | null
          moisture_ceiling?: number | null
          price_per_tonne?: number
          status?: string
          terms?: Json
          valid_from?: string
          valid_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "buyer_contracts_buyer_id_fkey"
            columns: ["buyer_id"]
            isOneToOne: false
            referencedRelation: "buyers"
            referencedColumns: ["id"]
          },
        ]
      }
      buyer_demands: {
        Row: {
          buyer_id: string
          buyer_name: string
          created_at: string
          id: string
          max_moisture_pct: number | null
          pickup_deadline: string
          radius_km: number
          residue_type: string
          status: string
          target_tonnes: number
        }
        Insert: {
          buyer_id: string
          buyer_name: string
          created_at?: string
          id?: string
          max_moisture_pct?: number | null
          pickup_deadline: string
          radius_km?: number
          residue_type?: string
          status?: string
          target_tonnes: number
        }
        Update: {
          buyer_id?: string
          buyer_name?: string
          created_at?: string
          id?: string
          max_moisture_pct?: number | null
          pickup_deadline?: string
          radius_km?: number
          residue_type?: string
          status?: string
          target_tonnes?: number
        }
        Relationships: [
          {
            foreignKeyName: "buyer_demands_buyer_id_fkey"
            columns: ["buyer_id"]
            isOneToOne: false
            referencedRelation: "buyers"
            referencedColumns: ["id"]
          },
        ]
      }
      buyer_offers: {
        Row: {
          buyer_id: string
          created_at: string
          id: string
          lot_id: string
          price_per_tonne: number
          quantity_tonnes: number
          status: string
          valid_until: string | null
        }
        Insert: {
          buyer_id: string
          created_at?: string
          id?: string
          lot_id: string
          price_per_tonne: number
          quantity_tonnes: number
          status?: string
          valid_until?: string | null
        }
        Update: {
          buyer_id?: string
          created_at?: string
          id?: string
          lot_id?: string
          price_per_tonne?: number
          quantity_tonnes?: number
          status?: string
          valid_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "buyer_offers_buyer_id_fkey"
            columns: ["buyer_id"]
            isOneToOne: false
            referencedRelation: "buyers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "buyer_offers_lot_id_fkey"
            columns: ["lot_id"]
            isOneToOne: false
            referencedRelation: "residue_lots"
            referencedColumns: ["id"]
          },
        ]
      }
      buyers: {
        Row: {
          active: boolean
          created_at: string
          id: string
          moisture_ceiling: number | null
          name: string
          pathway: string
          price_per_tonne: number | null
          profile_id: string | null
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          moisture_ceiling?: number | null
          name: string
          pathway: string
          price_per_tonne?: number | null
          profile_id?: string | null
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          moisture_ceiling?: number | null
          name?: string
          pathway?: string
          price_per_tonne?: number | null
          profile_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "buyers_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      consents: {
        Row: {
          accepted_at: string
          consent_type: string
          id: string
          profile_id: string
          revoked_at: string | null
          source: string
          version: string
        }
        Insert: {
          accepted_at?: string
          consent_type: string
          id?: string
          profile_id: string
          revoked_at?: string | null
          source: string
          version: string
        }
        Update: {
          accepted_at?: string
          consent_type?: string
          id?: string
          profile_id?: string
          revoked_at?: string | null
          source?: string
          version?: string
        }
        Relationships: [
          {
            foreignKeyName: "consents_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      credit_transactions: {
        Row: {
          amount: number
          created_at: string
          field_id: string | null
          id: string
          profile_id: string
          reason: string
          reference: string | null
        }
        Insert: {
          amount: number
          created_at?: string
          field_id?: string | null
          id?: string
          profile_id: string
          reason: string
          reference?: string | null
        }
        Update: {
          amount?: number
          created_at?: string
          field_id?: string | null
          id?: string
          profile_id?: string
          reason?: string
          reference?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "credit_transactions_field_id_fkey"
            columns: ["field_id"]
            isOneToOne: false
            referencedRelation: "fields"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credit_transactions_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      credit_wallets: {
        Row: {
          balance: number
          profile_id: string
          updated_at: string
        }
        Insert: {
          balance?: number
          profile_id: string
          updated_at?: string
        }
        Update: {
          balance?: number
          profile_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "credit_wallets_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      dispatches: {
        Row: {
          buyer_id: string | null
          created_at: string
          dispatched_at: string | null
          id: string
          invoice_id: string | null
          lot_ids: string[]
          route_metadata: Json
          status: string
        }
        Insert: {
          buyer_id?: string | null
          created_at?: string
          dispatched_at?: string | null
          id?: string
          invoice_id?: string | null
          lot_ids?: string[]
          route_metadata?: Json
          status?: string
        }
        Update: {
          buyer_id?: string | null
          created_at?: string
          dispatched_at?: string | null
          id?: string
          invoice_id?: string | null
          lot_ids?: string[]
          route_metadata?: Json
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "dispatches_buyer_id_fkey"
            columns: ["buyer_id"]
            isOneToOne: false
            referencedRelation: "buyers"
            referencedColumns: ["id"]
          },
        ]
      }
      evidence_assets: {
        Row: {
          booking_id: string | null
          captured_at: string | null
          created_at: string
          created_by: string | null
          field_id: string
          gps_accuracy_m: number | null
          id: string
          kind: string
          latitude: number | null
          longitude: number | null
          metadata: Json
          sha256: string | null
          source: string | null
          storage_path: string | null
          sync_source: string | null
        }
        Insert: {
          booking_id?: string | null
          captured_at?: string | null
          created_at?: string
          created_by?: string | null
          field_id: string
          gps_accuracy_m?: number | null
          id?: string
          kind: string
          latitude?: number | null
          longitude?: number | null
          metadata?: Json
          sha256?: string | null
          source?: string | null
          storage_path?: string | null
          sync_source?: string | null
        }
        Update: {
          booking_id?: string | null
          captured_at?: string | null
          created_at?: string
          created_by?: string | null
          field_id?: string
          gps_accuracy_m?: number | null
          id?: string
          kind?: string
          latitude?: number | null
          longitude?: number | null
          metadata?: Json
          sha256?: string | null
          source?: string | null
          storage_path?: string | null
          sync_source?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "evidence_assets_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evidence_assets_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evidence_assets_field_id_fkey"
            columns: ["field_id"]
            isOneToOne: false
            referencedRelation: "fields"
            referencedColumns: ["id"]
          },
        ]
      }
      field_events: {
        Row: {
          actor_id: string | null
          created_at: string
          event_type: string
          field_id: string
          id: string
          metadata: Json
          note: string | null
        }
        Insert: {
          actor_id?: string | null
          created_at?: string
          event_type: string
          field_id: string
          id?: string
          metadata?: Json
          note?: string | null
        }
        Update: {
          actor_id?: string | null
          created_at?: string
          event_type?: string
          field_id?: string
          id?: string
          metadata?: Json
          note?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "field_events_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "field_events_field_id_fkey"
            columns: ["field_id"]
            isOneToOne: false
            referencedRelation: "fields"
            referencedColumns: ["id"]
          },
        ]
      }
      fields: {
        Row: {
          acreage: number
          block: string | null
          boundary: unknown
          boundary_geojson: Json | null
          boundary_source: string
          boundary_verified: boolean
          center_lat: number | null
          center_lng: number | null
          clearance_deadline: string | null
          consent_id: string | null
          created_at: string
          crop: string
          district: string
          expected_harvest_date: string | null
          external_id: string | null
          geometry: Json | null
          geometry_area_acres: number | null
          geometry_type: string | null
          geometry_verified_at: string | null
          geometry_verified_by: string | null
          id: string
          khasra_no: string
          moisture_pct: number | null
          owner_id: string
          status: string
          updated_at: string
          variety: string | null
          village: string
        }
        Insert: {
          acreage: number
          block?: string | null
          boundary?: unknown
          boundary_geojson?: Json | null
          boundary_source?: string
          boundary_verified?: boolean
          center_lat?: number | null
          center_lng?: number | null
          clearance_deadline?: string | null
          consent_id?: string | null
          created_at?: string
          crop?: string
          district: string
          expected_harvest_date?: string | null
          external_id?: string | null
          geometry?: Json | null
          geometry_area_acres?: number | null
          geometry_type?: string | null
          geometry_verified_at?: string | null
          geometry_verified_by?: string | null
          id?: string
          khasra_no: string
          moisture_pct?: number | null
          owner_id: string
          status?: string
          updated_at?: string
          variety?: string | null
          village: string
        }
        Update: {
          acreage?: number
          block?: string | null
          boundary?: unknown
          boundary_geojson?: Json | null
          boundary_source?: string
          boundary_verified?: boolean
          center_lat?: number | null
          center_lng?: number | null
          clearance_deadline?: string | null
          consent_id?: string | null
          created_at?: string
          crop?: string
          district?: string
          expected_harvest_date?: string | null
          external_id?: string | null
          geometry?: Json | null
          geometry_area_acres?: number | null
          geometry_type?: string | null
          geometry_verified_at?: string | null
          geometry_verified_by?: string | null
          id?: string
          khasra_no?: string
          moisture_pct?: number | null
          owner_id?: string
          status?: string
          updated_at?: string
          variety?: string | null
          village?: string
        }
        Relationships: [
          {
            foreignKeyName: "fields_consent_id_fkey"
            columns: ["consent_id"]
            isOneToOne: false
            referencedRelation: "consents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fields_geometry_verified_by_fkey"
            columns: ["geometry_verified_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fields_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      firms_observations: {
        Row: {
          acquired_at: string | null
          confidence: string | null
          created_at: string
          frp: number | null
          id: string
          latitude: number
          longitude: number
          matched_field_id: string | null
          provider_observation_key: string
          raw: Json
          sensor: string
          source: string
        }
        Insert: {
          acquired_at?: string | null
          confidence?: string | null
          created_at?: string
          frp?: number | null
          id?: string
          latitude: number
          longitude: number
          matched_field_id?: string | null
          provider_observation_key: string
          raw?: Json
          sensor: string
          source: string
        }
        Update: {
          acquired_at?: string | null
          confidence?: string | null
          created_at?: string
          frp?: number | null
          id?: string
          latitude?: number
          longitude?: number
          matched_field_id?: string | null
          provider_observation_key?: string
          raw?: Json
          sensor?: string
          source?: string
        }
        Relationships: [
          {
            foreignKeyName: "firms_observations_matched_field_id_fkey"
            columns: ["matched_field_id"]
            isOneToOne: false
            referencedRelation: "fields"
            referencedColumns: ["id"]
          },
        ]
      }
      firms_observation_field_matches: {
        Row: {
          created_at: string
          field_id: string
          match_type: string
          matched_at: string
          observation_id: string
          source: string
        }
        Insert: {
          created_at?: string
          field_id: string
          match_type: string
          matched_at?: string
          observation_id: string
          source?: string
        }
        Update: {
          created_at?: string
          field_id?: string
          match_type?: string
          matched_at?: string
          observation_id?: string
          source?: string
        }
        Relationships: [
          {
            foreignKeyName: "firms_observation_field_matches_field_id_fkey"
            columns: ["field_id"]
            isOneToOne: false
            referencedRelation: "fields"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "firms_observation_field_matches_observation_id_fkey"
            columns: ["observation_id"]
            isOneToOne: false
            referencedRelation: "firms_observations"
            referencedColumns: ["id"]
          },
        ]
      }
      harvest_forecasts: {
        Row: {
          block: string | null
          confidence: number | null
          created_at: string
          field_id: string | null
          forecast_date: string
          id: string
          metadata: Json
          predicted_acres: number | null
          source: string
          variety: string | null
        }
        Insert: {
          block?: string | null
          confidence?: number | null
          created_at?: string
          field_id?: string | null
          forecast_date: string
          id?: string
          metadata?: Json
          predicted_acres?: number | null
          source: string
          variety?: string | null
        }
        Update: {
          block?: string | null
          confidence?: number | null
          created_at?: string
          field_id?: string | null
          forecast_date?: string
          id?: string
          metadata?: Json
          predicted_acres?: number | null
          source?: string
          variety?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "harvest_forecasts_field_id_fkey"
            columns: ["field_id"]
            isOneToOne: false
            referencedRelation: "fields"
            referencedColumns: ["id"]
          },
        ]
      }
      impact_methodologies: {
        Row: {
          active: boolean
          assumptions: Json
          created_at: string
          id: string
          name: string
          source_url: string | null
          version: string
        }
        Insert: {
          active?: boolean
          assumptions?: Json
          created_at?: string
          id?: string
          name: string
          source_url?: string | null
          version: string
        }
        Update: {
          active?: boolean
          assumptions?: Json
          created_at?: string
          id?: string
          name?: string
          source_url?: string | null
          version?: string
        }
        Relationships: []
      }
      jobs: {
        Row: {
          actual_arrived_at: string | null
          actual_completed_at: string | null
          booking_id: string
          created_at: string
          failure_reason: string | null
          id: string
          last_transition_at: string | null
          machine_id: string | null
          operator_id: string | null
          route_metadata: Json
          slot_end: string | null
          slot_start: string | null
          status: string
          updated_at: string
        }
        Insert: {
          actual_arrived_at?: string | null
          actual_completed_at?: string | null
          booking_id: string
          created_at?: string
          failure_reason?: string | null
          id?: string
          last_transition_at?: string | null
          machine_id?: string | null
          operator_id?: string | null
          route_metadata?: Json
          slot_end?: string | null
          slot_start?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          actual_arrived_at?: string | null
          actual_completed_at?: string | null
          booking_id?: string
          created_at?: string
          failure_reason?: string | null
          id?: string
          last_transition_at?: string | null
          machine_id?: string | null
          operator_id?: string | null
          route_metadata?: Json
          slot_end?: string | null
          slot_start?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "jobs_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: true
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "jobs_machine_id_fkey"
            columns: ["machine_id"]
            isOneToOne: false
            referencedRelation: "machines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "jobs_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      machine_locations: {
        Row: {
          fuel_pct: number | null
          id: string
          latitude: number
          longitude: number
          machine_id: string
          recorded_at: string
          source: string
          speed_kmh: number | null
        }
        Insert: {
          fuel_pct?: number | null
          id?: string
          latitude: number
          longitude: number
          machine_id: string
          recorded_at?: string
          source?: string
          speed_kmh?: number | null
        }
        Update: {
          fuel_pct?: number | null
          id?: string
          latitude?: number
          longitude?: number
          machine_id?: string
          recorded_at?: string
          source?: string
          speed_kmh?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "machine_locations_machine_id_fkey"
            columns: ["machine_id"]
            isOneToOne: false
            referencedRelation: "machines"
            referencedColumns: ["id"]
          },
        ]
      }
      machines: {
        Row: {
          availability_calendar: Json
          capacity_acres_day: number | null
          created_at: string
          current_lat: number | null
          current_lng: number | null
          external_id: string
          fuel_pct: number | null
          id: string
          machine_type: string | null
          name: string
          operator_name: string | null
          operator_phone: string | null
          operator_user_id: string | null
          owner_name: string | null
          service_area: Json
          status: string
          updated_at: string
        }
        Insert: {
          availability_calendar?: Json
          capacity_acres_day?: number | null
          created_at?: string
          current_lat?: number | null
          current_lng?: number | null
          external_id: string
          fuel_pct?: number | null
          id?: string
          machine_type?: string | null
          name: string
          operator_name?: string | null
          operator_phone?: string | null
          operator_user_id?: string | null
          owner_name?: string | null
          service_area?: Json
          status?: string
          updated_at?: string
        }
        Update: {
          availability_calendar?: Json
          capacity_acres_day?: number | null
          created_at?: string
          current_lat?: number | null
          current_lng?: number | null
          external_id?: string
          fuel_pct?: number | null
          id?: string
          machine_type?: string | null
          name?: string
          operator_name?: string | null
          operator_phone?: string | null
          operator_user_id?: string | null
          owner_name?: string | null
          service_area?: Json
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "machines_operator_user_id_fkey"
            columns: ["operator_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string
          created_at: string
          id: string
          profile_id: string
          read_at: string | null
          title: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          profile_id: string
          read_at?: string | null
          title: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          profile_id?: string
          read_at?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount: number
          booking_id: string
          created_at: string
          currency: string
          failure_reason: string | null
          farmer_id: string
          id: string
          idempotency_key: string | null
          initiated_at: string | null
          metadata: Json
          provider: string | null
          provider_reference: string | null
          settled_at: string | null
          status: string
          webhook_received_at: string | null
        }
        Insert: {
          amount: number
          booking_id: string
          created_at?: string
          currency?: string
          failure_reason?: string | null
          farmer_id: string
          id?: string
          idempotency_key?: string | null
          initiated_at?: string | null
          metadata?: Json
          provider?: string | null
          provider_reference?: string | null
          settled_at?: string | null
          status?: string
          webhook_received_at?: string | null
        }
        Update: {
          amount?: number
          booking_id?: string
          created_at?: string
          currency?: string
          failure_reason?: string | null
          farmer_id?: string
          id?: string
          idempotency_key?: string | null
          initiated_at?: string | null
          metadata?: Json
          provider?: string | null
          provider_reference?: string | null
          settled_at?: string | null
          status?: string
          webhook_received_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payments_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_farmer_id_fkey"
            columns: ["farmer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          consent_status: string
          created_at: string
          district: string | null
          farmer_registry_ref: string | null
          full_name: string | null
          id: string
          phone: string | null
          preferred_language: string
          role: string
          updated_at: string
          village: string | null
        }
        Insert: {
          consent_status?: string
          created_at?: string
          district?: string | null
          farmer_registry_ref?: string | null
          full_name?: string | null
          id: string
          phone?: string | null
          preferred_language?: string
          role?: string
          updated_at?: string
          village?: string | null
        }
        Update: {
          consent_status?: string
          created_at?: string
          district?: string | null
          farmer_registry_ref?: string | null
          full_name?: string | null
          id?: string
          phone?: string | null
          preferred_language?: string
          role?: string
          updated_at?: string
          village?: string | null
        }
        Relationships: []
      }
      residue_lots: {
        Row: {
          assigned_buyer_id: string | null
          baled_at: string | null
          booking_id: string | null
          chain_of_custody: Json
          created_at: string
          field_id: string
          id: string
          job_id: string | null
          moisture_checked_at: string | null
          moisture_pct: number | null
          qr_code: string | null
          quality_grade: string | null
          quality_notes: string | null
          quantity_tonnes: number | null
          status: string
          storage_yard_id: string | null
          updated_at: string
          weight_kg: number | null
        }
        Insert: {
          assigned_buyer_id?: string | null
          baled_at?: string | null
          booking_id?: string | null
          chain_of_custody?: Json
          created_at?: string
          field_id: string
          id?: string
          job_id?: string | null
          moisture_checked_at?: string | null
          moisture_pct?: number | null
          qr_code?: string | null
          quality_grade?: string | null
          quality_notes?: string | null
          quantity_tonnes?: number | null
          status?: string
          storage_yard_id?: string | null
          updated_at?: string
          weight_kg?: number | null
        }
        Update: {
          assigned_buyer_id?: string | null
          baled_at?: string | null
          booking_id?: string | null
          chain_of_custody?: Json
          created_at?: string
          field_id?: string
          id?: string
          job_id?: string | null
          moisture_checked_at?: string | null
          moisture_pct?: number | null
          qr_code?: string | null
          quality_grade?: string | null
          quality_notes?: string | null
          quantity_tonnes?: number | null
          status?: string
          storage_yard_id?: string | null
          updated_at?: string
          weight_kg?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "residue_lots_assigned_buyer_id_fkey"
            columns: ["assigned_buyer_id"]
            isOneToOne: false
            referencedRelation: "buyers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "residue_lots_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "residue_lots_field_id_fkey"
            columns: ["field_id"]
            isOneToOne: false
            referencedRelation: "fields"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "residue_lots_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "residue_lots_storage_yard_id_fkey"
            columns: ["storage_yard_id"]
            isOneToOne: false
            referencedRelation: "storage_yards"
            referencedColumns: ["id"]
          },
        ]
      }
      residue_pool_members: {
        Row: {
          committed_tonnes: number
          created_at: string
          farmer_id: string
          id: string
          pool_id: string
          residue_lot_id: string
          status: string
        }
        Insert: {
          committed_tonnes: number
          created_at?: string
          farmer_id: string
          id?: string
          pool_id: string
          residue_lot_id: string
          status?: string
        }
        Update: {
          committed_tonnes?: number
          created_at?: string
          farmer_id?: string
          id?: string
          pool_id?: string
          residue_lot_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "residue_pool_members_farmer_id_fkey"
            columns: ["farmer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "residue_pool_members_pool_id_fkey"
            columns: ["pool_id"]
            isOneToOne: false
            referencedRelation: "residue_pools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "residue_pool_members_residue_lot_id_fkey"
            columns: ["residue_lot_id"]
            isOneToOne: false
            referencedRelation: "residue_lots"
            referencedColumns: ["id"]
          },
        ]
      }
      residue_pools: {
        Row: {
          buyer_demand_id: string | null
          created_at: string
          created_by: string
          current_tonnes: number
          id: string
          name: string
          pickup_deadline: string | null
          status: string
          target_tonnes: number
        }
        Insert: {
          buyer_demand_id?: string | null
          created_at?: string
          created_by: string
          current_tonnes?: number
          id?: string
          name: string
          pickup_deadline?: string | null
          status?: string
          target_tonnes: number
        }
        Update: {
          buyer_demand_id?: string | null
          created_at?: string
          created_by?: string
          current_tonnes?: number
          id?: string
          name?: string
          pickup_deadline?: string | null
          status?: string
          target_tonnes?: number
        }
        Relationships: [
          {
            foreignKeyName: "residue_pools_buyer_demand_id_fkey"
            columns: ["buyer_demand_id"]
            isOneToOne: false
            referencedRelation: "buyer_demands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "residue_pools_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      soil_reports: {
        Row: {
          action_plan: Json
          created_at: string
          field_id: string | null
          id: string
          lab_name: string | null
          nitrogen: number | null
          organic_carbon: number | null
          ph: number | null
          phosphorus: number | null
          potassium: number | null
          profile_id: string | null
          source: string | null
          tested_at: string | null
        }
        Insert: {
          action_plan?: Json
          created_at?: string
          field_id?: string | null
          id?: string
          lab_name?: string | null
          nitrogen?: number | null
          organic_carbon?: number | null
          ph?: number | null
          phosphorus?: number | null
          potassium?: number | null
          profile_id?: string | null
          source?: string | null
          tested_at?: string | null
        }
        Update: {
          action_plan?: Json
          created_at?: string
          field_id?: string | null
          id?: string
          lab_name?: string | null
          nitrogen?: number | null
          organic_carbon?: number | null
          ph?: number | null
          phosphorus?: number | null
          potassium?: number | null
          profile_id?: string | null
          source?: string | null
          tested_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "soil_reports_field_id_fkey"
            columns: ["field_id"]
            isOneToOne: false
            referencedRelation: "fields"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "soil_reports_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      storage_yards: {
        Row: {
          active: boolean
          capacity_tonnes: number
          created_at: string
          current_load_tonnes: number
          id: string
          location: unknown
          name: string
        }
        Insert: {
          active?: boolean
          capacity_tonnes: number
          created_at?: string
          current_load_tonnes?: number
          id?: string
          location?: unknown
          name: string
        }
        Update: {
          active?: boolean
          capacity_tonnes?: number
          created_at?: string
          current_load_tonnes?: number
          id?: string
          location?: unknown
          name?: string
        }
        Relationships: []
      }
      verification_events: {
        Row: {
          confidence: number | null
          created_at: string
          evidence_url: string | null
          field_id: string
          id: string
          metadata: Json
          method: string
          result: string
        }
        Insert: {
          confidence?: number | null
          created_at?: string
          evidence_url?: string | null
          field_id: string
          id?: string
          metadata?: Json
          method: string
          result: string
        }
        Update: {
          confidence?: number | null
          created_at?: string
          evidence_url?: string | null
          field_id?: string
          id?: string
          metadata?: Json
          method?: string
          result?: string
        }
        Relationships: [
          {
            foreignKeyName: "verification_events_field_id_fkey"
            columns: ["field_id"]
            isOneToOne: false
            referencedRelation: "fields"
            referencedColumns: ["id"]
          },
        ]
      }
      weather_snapshots: {
        Row: {
          created_at: string
          field_id: string
          id: string
          observed_at: string
          payload: Json
          provider: string
        }
        Insert: {
          created_at?: string
          field_id: string
          id?: string
          observed_at: string
          payload: Json
          provider: string
        }
        Update: {
          created_at?: string
          field_id?: string
          id?: string
          observed_at?: string
          payload?: Json
          provider?: string
        }
        Relationships: [
          {
            foreignKeyName: "weather_snapshots_field_id_fkey"
            columns: ["field_id"]
            isOneToOne: false
            referencedRelation: "fields"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      record_farmer_network_consent: {
        Args: Record<PropertyKey, never>
        Returns: {
          accepted_at: string
          consent_type: string
          id: string
          profile_id: string
          revoked_at: string | null
          source: string
          version: string
        }
        SetofOptions: {
          from: "*"
          to: "consents"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      accept_buyer_offer: {
        Args: { p_offer_id: string }
        Returns: {
          buyer_id: string
          created_at: string
          id: string
          lot_id: string
          price_per_tonne: number
          quantity_tonnes: number
          status: string
          valid_until: string | null
        }
        SetofOptions: {
          from: "*"
          to: "buyer_offers"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      cancel_clearance_booking: {
        Args: { p_booking_id: string }
        Returns: {
          accepted_at: string | null
          assigned_at: string | null
          cancelled_at: string | null
          created_at: string
          field_id: string
          guaranteed_by_date: string | null
          id: string
          machine_id: string | null
          reservation_state: string
          penalty_amount: number
          pricing_band: string | null
          quote_metadata: Json
          quoted_amount: number
          rate_per_acre: number
          requested_date: string
          status: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "bookings"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      create_residue_pool: {
        Args: {
          p_buyer_demand_id?: string
          p_name: string
          p_pickup_deadline: string
          p_target_tonnes: number
        }
        Returns: {
          buyer_demand_id: string | null
          created_at: string
          created_by: string
          current_tonnes: number
          id: string
          name: string
          pickup_deadline: string | null
          status: string
          target_tonnes: number
        }
        SetofOptions: {
          from: "*"
          to: "residue_pools"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      join_residue_pool: {
        Args: { p_pool_id: string; p_quantity_tonnes: number }
        Returns: {
          committed_tonnes: number
          created_at: string
          farmer_id: string
          id: string
          pool_id: string
          residue_lot_id: string
          status: string
        }
        SetofOptions: {
          from: "*"
          to: "residue_pool_members"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      record_verification_review: {
        Args: {
          p_confidence: number
          p_field_id: string
          p_metadata?: Json
          p_result: string
        }
        Returns: {
          confidence: number | null
          created_at: string
          evidence_url: string | null
          field_id: string
          id: string
          metadata: Json
          method: string
          result: string
        }
        SetofOptions: {
          from: "*"
          to: "verification_events"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      reserve_clearance_booking: {
        Args: {
          p_field_id: string
          p_guaranteed_by_date: string
          p_penalty_amount: number
          p_pricing_band: string
          p_quote_metadata: Json
          p_quoted_amount: number
          p_rate_per_acre: number
          p_requested_date: string
        }
        Returns: {
          accepted_at: string | null
          assigned_at: string | null
          cancelled_at: string | null
          created_at: string
          field_id: string
          guaranteed_by_date: string | null
          id: string
          machine_id: string | null
          reservation_state: string
          penalty_amount: number
          pricing_band: string | null
          quote_metadata: Json
          quoted_amount: number
          rate_per_acre: number
          requested_date: string
          status: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "bookings"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      reserve_clearance_booking_v2: {
        Args: { p_field_id: string; p_requested_date: string }
        Returns: {
          accepted_at: string | null
          assigned_at: string | null
          cancelled_at: string | null
          created_at: string
          field_id: string
          guaranteed_by_date: string | null
          id: string
          machine_id: string | null
          reservation_state: string
          penalty_amount: number
          pricing_band: string | null
          quote_metadata: Json
          quoted_amount: number
          rate_per_acre: number
          requested_date: string
          status: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "bookings"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      transition_job: {
        Args: { p_job_id: string; p_metadata?: Json; p_next_status: string }
        Returns: {
          actual_arrived_at: string | null
          actual_completed_at: string | null
          booking_id: string
          created_at: string
          failure_reason: string | null
          id: string
          last_transition_at: string | null
          machine_id: string | null
          operator_id: string | null
          route_metadata: Json
          slot_end: string | null
          slot_start: string | null
          status: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "jobs"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      verify_field_geometry: {
        Args: { p_field_id: string; p_metadata?: Json; p_source: string }
        Returns: {
          acreage: number
          block: string | null
          boundary: unknown
          boundary_geojson: Json | null
          boundary_source: string
          boundary_verified: boolean
          center_lat: number | null
          center_lng: number | null
          clearance_deadline: string | null
          consent_id: string | null
          created_at: string
          crop: string
          district: string
          expected_harvest_date: string | null
          external_id: string | null
          geometry: Json | null
          geometry_area_acres: number | null
          geometry_type: string | null
          geometry_verified_at: string | null
          geometry_verified_by: string | null
          id: string
          khasra_no: string
          moisture_pct: number | null
          owner_id: string
          status: string
          updated_at: string
          variety: string | null
          village: string
        }
        SetofOptions: {
          from: "*"
          to: "fields"
          isOneToOne: true
          isSetofReturn: false
        }
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
