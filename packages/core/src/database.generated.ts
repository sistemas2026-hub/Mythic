export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      brands: {
        Row: {
          created_at: string;
          id: string;
          name: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          name: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          name?: string;
        };
        Relationships: [];
      };
      categories: {
        Row: {
          created_at: string;
          id: string;
          name: string;
          slug: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          name: string;
          slug: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          name?: string;
          slug?: string;
        };
        Relationships: [];
      };
      customers: {
        Row: {
          created_at: string;
          email: string | null;
          full_name: string;
          id: string;
          phone: string | null;
          profile_id: string | null;
        };
        Insert: {
          created_at?: string;
          email?: string | null;
          full_name: string;
          id?: string;
          phone?: string | null;
          profile_id?: string | null;
        };
        Update: {
          created_at?: string;
          email?: string | null;
          full_name?: string;
          id?: string;
          phone?: string | null;
          profile_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'customers_profile_id_fkey';
            columns: ['profile_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      inventory: {
        Row: {
          id: string;
          min_quantity: number;
          product_id: string;
          quantity: number;
          store_id: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          min_quantity?: number;
          product_id: string;
          quantity?: number;
          store_id: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          min_quantity?: number;
          product_id?: string;
          quantity?: number;
          store_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'inventory_product_id_fkey';
            columns: ['product_id'];
            isOneToOne: false;
            referencedRelation: 'products';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'inventory_store_id_fkey';
            columns: ['store_id'];
            isOneToOne: false;
            referencedRelation: 'stores';
            referencedColumns: ['id'];
          },
        ];
      };
      inventory_movements: {
        Row: {
          created_at: string;
          created_by: string | null;
          id: string;
          product_id: string;
          quantity: number;
          reason: string | null;
          reference_id: string | null;
          store_id: string;
          type: string;
        };
        Insert: {
          created_at?: string;
          created_by?: string | null;
          id?: string;
          product_id: string;
          quantity: number;
          reason?: string | null;
          reference_id?: string | null;
          store_id: string;
          type: string;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          id?: string;
          product_id?: string;
          quantity?: number;
          reason?: string | null;
          reference_id?: string | null;
          store_id?: string;
          type?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'inventory_movements_product_id_fkey';
            columns: ['product_id'];
            isOneToOne: false;
            referencedRelation: 'products';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'inventory_movements_store_id_fkey';
            columns: ['store_id'];
            isOneToOne: false;
            referencedRelation: 'stores';
            referencedColumns: ['id'];
          },
        ];
      };
      order_items: {
        Row: {
          id: string;
          line_total: number;
          order_id: string;
          product_id: string;
          quantity: number;
          unit_price: number;
        };
        Insert: {
          id?: string;
          line_total: number;
          order_id: string;
          product_id: string;
          quantity: number;
          unit_price: number;
        };
        Update: {
          id?: string;
          line_total?: number;
          order_id?: string;
          product_id?: string;
          quantity?: number;
          unit_price?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'order_items_order_id_fkey';
            columns: ['order_id'];
            isOneToOne: false;
            referencedRelation: 'orders';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'order_items_product_id_fkey';
            columns: ['product_id'];
            isOneToOne: false;
            referencedRelation: 'products';
            referencedColumns: ['id'];
          },
        ];
      };
      orders: {
        Row: {
          created_at: string;
          created_by: string | null;
          customer_id: string | null;
          id: string;
          notes: string | null;
          status: string;
          store_id: string;
          subtotal: number;
          total: number;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          created_by?: string | null;
          customer_id?: string | null;
          id?: string;
          notes?: string | null;
          status?: string;
          store_id: string;
          subtotal?: number;
          total?: number;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          customer_id?: string | null;
          id?: string;
          notes?: string | null;
          status?: string;
          store_id?: string;
          subtotal?: number;
          total?: number;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'orders_customer_id_fkey';
            columns: ['customer_id'];
            isOneToOne: false;
            referencedRelation: 'customers';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'orders_store_id_fkey';
            columns: ['store_id'];
            isOneToOne: false;
            referencedRelation: 'stores';
            referencedColumns: ['id'];
          },
        ];
      };
      products: {
        Row: {
          barcode: string | null;
          brand_id: string | null;
          category_id: string | null;
          concentration: string | null;
          cost: number | null;
          created_at: string;
          description: string | null;
          gender: string | null;
          id: string;
          image_url: string | null;
          is_active: boolean;
          name: string;
          price: number;
          sku: string | null;
          updated_at: string;
          volume_ml: number | null;
        };
        Insert: {
          barcode?: string | null;
          brand_id?: string | null;
          category_id?: string | null;
          concentration?: string | null;
          cost?: number | null;
          created_at?: string;
          description?: string | null;
          gender?: string | null;
          id?: string;
          image_url?: string | null;
          is_active?: boolean;
          name: string;
          price?: number;
          sku?: string | null;
          updated_at?: string;
          volume_ml?: number | null;
        };
        Update: {
          barcode?: string | null;
          brand_id?: string | null;
          category_id?: string | null;
          concentration?: string | null;
          cost?: number | null;
          created_at?: string;
          description?: string | null;
          gender?: string | null;
          id?: string;
          image_url?: string | null;
          is_active?: boolean;
          name?: string;
          price?: number;
          sku?: string | null;
          updated_at?: string;
          volume_ml?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: 'products_brand_id_fkey';
            columns: ['brand_id'];
            isOneToOne: false;
            referencedRelation: 'brands';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'products_category_id_fkey';
            columns: ['category_id'];
            isOneToOne: false;
            referencedRelation: 'categories';
            referencedColumns: ['id'];
          },
        ];
      };
      profiles: {
        Row: {
          created_at: string;
          full_name: string | null;
          id: string;
          phone: string | null;
          role: string;
          store_id: string | null;
        };
        Insert: {
          created_at?: string;
          full_name?: string | null;
          id: string;
          phone?: string | null;
          role?: string;
          store_id?: string | null;
        };
        Update: {
          created_at?: string;
          full_name?: string | null;
          id?: string;
          phone?: string | null;
          role?: string;
          store_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'profiles_store_id_fkey';
            columns: ['store_id'];
            isOneToOne: false;
            referencedRelation: 'stores';
            referencedColumns: ['id'];
          },
        ];
      };
      sale_items: {
        Row: {
          id: string;
          line_total: number;
          product_id: string;
          quantity: number;
          sale_id: string;
          unit_price: number;
        };
        Insert: {
          id?: string;
          line_total: number;
          product_id: string;
          quantity: number;
          sale_id: string;
          unit_price: number;
        };
        Update: {
          id?: string;
          line_total?: number;
          product_id?: string;
          quantity?: number;
          sale_id?: string;
          unit_price?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'sale_items_product_id_fkey';
            columns: ['product_id'];
            isOneToOne: false;
            referencedRelation: 'products';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'sale_items_sale_id_fkey';
            columns: ['sale_id'];
            isOneToOne: false;
            referencedRelation: 'sales';
            referencedColumns: ['id'];
          },
        ];
      };
      sales: {
        Row: {
          created_at: string;
          customer_id: string | null;
          discount: number;
          id: string;
          payment_method: string;
          sold_by: string | null;
          status: string;
          store_id: string;
          subtotal: number;
          total: number;
        };
        Insert: {
          created_at?: string;
          customer_id?: string | null;
          discount?: number;
          id?: string;
          payment_method?: string;
          sold_by?: string | null;
          status?: string;
          store_id: string;
          subtotal?: number;
          total?: number;
        };
        Update: {
          created_at?: string;
          customer_id?: string | null;
          discount?: number;
          id?: string;
          payment_method?: string;
          sold_by?: string | null;
          status?: string;
          store_id?: string;
          subtotal?: number;
          total?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'sales_customer_id_fkey';
            columns: ['customer_id'];
            isOneToOne: false;
            referencedRelation: 'customers';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'sales_store_id_fkey';
            columns: ['store_id'];
            isOneToOne: false;
            referencedRelation: 'stores';
            referencedColumns: ['id'];
          },
        ];
      };
      stores: {
        Row: {
          address: string | null;
          code: string;
          created_at: string;
          id: string;
          is_active: boolean;
          name: string;
          phone: string | null;
        };
        Insert: {
          address?: string | null;
          code: string;
          created_at?: string;
          id?: string;
          is_active?: boolean;
          name: string;
          phone?: string | null;
        };
        Update: {
          address?: string | null;
          code?: string;
          created_at?: string;
          id?: string;
          is_active?: boolean;
          name?: string;
          phone?: string | null;
        };
        Relationships: [];
      };
      suppliers: {
        Row: {
          contact_name: string | null;
          created_at: string;
          email: string | null;
          id: string;
          name: string;
          phone: string | null;
        };
        Insert: {
          contact_name?: string | null;
          created_at?: string;
          email?: string | null;
          id?: string;
          name: string;
          phone?: string | null;
        };
        Update: {
          contact_name?: string | null;
          created_at?: string;
          email?: string | null;
          id?: string;
          name?: string;
          phone?: string | null;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      current_app_role: { Args: never; Returns: string };
      is_admin: { Args: never; Returns: boolean };
      is_staff: { Args: never; Returns: boolean };
      register_sale: {
        Args: {
          p_customer_id?: string;
          p_discount?: number;
          p_items?: Json;
          p_payment_method?: string;
          p_store_id: string;
        };
        Returns: string;
      };
      show_limit: { Args: never; Returns: number };
      show_trgm: { Args: { '': string }; Returns: string[] };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, 'public'>];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    ? (DefaultSchema['Tables'] & DefaultSchema['Views'])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema['Tables'] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema['Tables'] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema['Enums'] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums']
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums'][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema['Enums']
    ? DefaultSchema['Enums'][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema['CompositeTypes'] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes']
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes'][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema['CompositeTypes']
    ? DefaultSchema['CompositeTypes'][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {},
  },
} as const;
