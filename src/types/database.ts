export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          full_name: string | null;
          username: string | null;
          avatar_path: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          full_name?: string | null;
          username?: string | null;
          avatar_path?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          full_name?: string | null;
          username?: string | null;
          avatar_path?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "profiles_id_fkey";
            columns: ["id"];
            referencedRelation: "users";
            referencedColumns: ["id"];
          }
        ];
      };
      closets: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          cover_image_path: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          name: string;
          cover_image_path?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          name?: string;
          cover_image_path?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "closets_user_id_fkey";
            columns: ["user_id"];
            referencedRelation: "users";
            referencedColumns: ["id"];
          }
        ];
      };
      clothing_items: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          primary_image_path: string;
          brand: string | null;
          price_amount: string | null;
          price_currency: string | null;
          clothing_type: string | null;
          color: string | null;
          season: string[] | null;
          material: string[] | null;
          custom_fields: Json | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          name: string;
          primary_image_path: string;
          brand?: string | null;
          price_amount?: string | null;
          price_currency?: string | null;
          clothing_type?: string | null;
          color?: string | null;
          season?: string[] | null;
          material?: string[] | null;
          custom_fields?: Json | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          name?: string;
          primary_image_path?: string;
          brand?: string | null;
          price_amount?: string | null;
          price_currency?: string | null;
          clothing_type?: string | null;
          color?: string | null;
          season?: string[] | null;
          material?: string[] | null;
          custom_fields?: Json | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "clothing_items_user_id_fkey";
            columns: ["user_id"];
            referencedRelation: "users";
            referencedColumns: ["id"];
          }
        ];
      };
      clothing_item_images: {
        Row: {
          id: string;
          item_id: string;
          image_path: string;
          sort_order: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          item_id: string;
          image_path: string;
          sort_order?: number;
          created_at?: string;
        };
        Update: {
          image_path?: string;
          sort_order?: number;
        };
        Relationships: [
          {
            foreignKeyName: "clothing_item_images_item_id_fkey";
            columns: ["item_id"];
            referencedRelation: "clothing_items";
            referencedColumns: ["id"];
          }
        ];
      };
      clothing_item_closets: {
        Row: {
          item_id: string;
          closet_id: string;
          created_at: string;
        };
        Insert: {
          item_id: string;
          closet_id: string;
          created_at?: string;
        };
        Update: {};
        Relationships: [
          {
            foreignKeyName: "clothing_item_closets_item_id_fkey";
            columns: ["item_id"];
            referencedRelation: "clothing_items";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "clothing_item_closets_closet_id_fkey";
            columns: ["closet_id"];
            referencedRelation: "closets";
            referencedColumns: ["id"];
          }
        ];
      };
      item_metadata_options: {
        Row: {
          id: string;
          user_id: string;
          category: string;
          label: string;
          label_normalized: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          category: string;
          label: string;
          created_at?: string;
        };
        Update: {
          user_id?: string;
          category?: string;
          label?: string;
        };
        Relationships: [
          {
            foreignKeyName: "item_metadata_options_user_id_fkey";
            columns: ["user_id"];
            referencedRelation: "users";
            referencedColumns: ["id"];
          }
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};
