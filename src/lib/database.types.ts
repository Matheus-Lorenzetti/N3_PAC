
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "graphql_public": {
          Tables: {
            [_ in never]: never
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "graphql":
{ Args: { "extensions"?: Json,"operationName"?: string,"query"?: string,"variables"?: Json }; Returns: Json
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        },"public": {
          Tables: {
            "empresas": {
                  Row: {
                    "ativo": boolean,"bairro": string | null,"cep": string | null,"cidade": string,"criado_em": string,"eh_sede": boolean,"endereco": string,"id": number,"latitude": number | null,"longitude": number | null,"nome": string,"uf": string
                  }
                  ComputedFields: never
                  Insert: {
                    "ativo"?: boolean,"bairro"?: string | null,"cep"?: string | null,"cidade": string,"criado_em"?: string,"eh_sede"?: boolean,"endereco": string,"id"?: never,"latitude"?: number | null,"longitude"?: number | null,"nome": string,"uf": string
                  }
                  Update: {
                    "ativo"?: boolean,"bairro"?: string | null,"cep"?: string | null,"cidade"?: string,"criado_em"?: string,"eh_sede"?: boolean,"endereco"?: string,"id"?: never,"latitude"?: number | null,"longitude"?: number | null,"nome"?: string,"uf"?: string
                  }
                  Relationships: [
                    
                  ]
                },"funcionarios": {
                  Row: {
                    "ativo": boolean,"criado_em": string,"id": string,"nome": string,"perfil": Database["public"]['Enums']["perfil_funcionario"]
                  }
                  ComputedFields: never
                  Insert: {
                    "ativo"?: boolean,"criado_em"?: string,"id": string,"nome": string,"perfil": Database["public"]['Enums']["perfil_funcionario"]
                  }
                  Update: {
                    "ativo"?: boolean,"criado_em"?: string,"id"?: string,"nome"?: string,"perfil"?: Database["public"]['Enums']["perfil_funcionario"]
                  }
                  Relationships: [
                    
                  ]
                },"localizacoes": {
                  Row: {
                    "id": number,"latitude": number,"longitude": number,"motorista_id": string,"precisao_m": number | null,"registrado_em": string,"velocidade_ms": number | null
                  }
                  ComputedFields: never
                  Insert: {
                    "id"?: never,"latitude": number,"longitude": number,"motorista_id"?: string,"precisao_m"?: number | null,"registrado_em"?: string,"velocidade_ms"?: number | null
                  }
                  Update: {
                    "id"?: never,"latitude"?: number,"longitude"?: number,"motorista_id"?: string,"precisao_m"?: number | null,"registrado_em"?: string,"velocidade_ms"?: number | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "localizacoes_motorista_id_fkey"
      columns: ["motorista_id"]
isOneToOne: false
      referencedRelation: "funcionarios"
      referencedColumns: ["id"]
    }
                  ]
                },"rotas": {
                  Row: {
                    "calculada_em": string,"data": string,"distancia_m": number,"duracao_s": number,"linha": NonNullable<Json>,"motorista_id": string,"ordem": (number)[]
                  }
                  ComputedFields: never
                  Insert: {
                    "calculada_em"?: string,"data"?: string,"distancia_m"?: number,"duracao_s"?: number,"linha"?: NonNullable<Json>,"motorista_id"?: string,"ordem"?: (number)[]
                  }
                  Update: {
                    "calculada_em"?: string,"data"?: string,"distancia_m"?: number,"duracao_s"?: number,"linha"?: NonNullable<Json>,"motorista_id"?: string,"ordem"?: (number)[]
                  }
                  Relationships: [
                    {
      foreignKeyName: "rotas_motorista_id_fkey"
      columns: ["motorista_id"]
isOneToOne: false
      referencedRelation: "funcionarios"
      referencedColumns: ["id"]
    }
                  ]
                },"servico_eventos": {
                  Row: {
                    "alterado_em": string,"alterado_por": string | null,"id": number,"servico_id": number,"status_anterior": Database["public"]['Enums']["status_servico"] | null,"status_novo": Database["public"]['Enums']["status_servico"]
                  }
                  ComputedFields: never
                  Insert: {
                    "alterado_em"?: string,"alterado_por"?: string | null,"id"?: never,"servico_id": number,"status_anterior"?: Database["public"]['Enums']["status_servico"] | null,"status_novo": Database["public"]['Enums']["status_servico"]
                  }
                  Update: {
                    "alterado_em"?: string,"alterado_por"?: string | null,"id"?: never,"servico_id"?: number,"status_anterior"?: Database["public"]['Enums']["status_servico"] | null,"status_novo"?: Database["public"]['Enums']["status_servico"]
                  }
                  Relationships: [
                    {
      foreignKeyName: "servico_eventos_alterado_por_fkey"
      columns: ["alterado_por"]
isOneToOne: false
      referencedRelation: "funcionarios"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "servico_eventos_servico_id_fkey"
      columns: ["servico_id"]
isOneToOne: false
      referencedRelation: "servicos"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "servico_eventos_servico_id_fkey"
      columns: ["servico_id"]
isOneToOne: false
      referencedRelation: "servicos_situacao"
      referencedColumns: ["id"]
    }
                  ]
                },"servicos": {
                  Row: {
                    "aceito_em": string | null,"concluido_em": string | null,"criado_em": string,"criado_por": string | null,"data_servico": string,"empresa_id": number,"id": number,"motorista_id": string,"observacao": string | null,"status": Database["public"]['Enums']["status_servico"],"tipo": Database["public"]['Enums']["tipo_servico"]
                  }
                  ComputedFields: never
                  Insert: {
                    "aceito_em"?: string | null,"concluido_em"?: string | null,"criado_em"?: string,"criado_por"?: string | null,"data_servico"?: string,"empresa_id": number,"id"?: never,"motorista_id": string,"observacao"?: string | null,"status"?: Database["public"]['Enums']["status_servico"],"tipo": Database["public"]['Enums']["tipo_servico"]
                  }
                  Update: {
                    "aceito_em"?: string | null,"concluido_em"?: string | null,"criado_em"?: string,"criado_por"?: string | null,"data_servico"?: string,"empresa_id"?: number,"id"?: never,"motorista_id"?: string,"observacao"?: string | null,"status"?: Database["public"]['Enums']["status_servico"],"tipo"?: Database["public"]['Enums']["tipo_servico"]
                  }
                  Relationships: [
                    {
      foreignKeyName: "servicos_criado_por_fkey"
      columns: ["criado_por"]
isOneToOne: false
      referencedRelation: "funcionarios"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "servicos_empresa_id_fkey"
      columns: ["empresa_id"]
isOneToOne: false
      referencedRelation: "empresas"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "servicos_motorista_id_fkey"
      columns: ["motorista_id"]
isOneToOne: false
      referencedRelation: "funcionarios"
      referencedColumns: ["id"]
    }
                  ]
                },"veiculos": {
                  Row: {
                    "criado_em": string,"id": number,"modelo": string | null,"motorista_id": string | null,"placa": string
                  }
                  ComputedFields: never
                  Insert: {
                    "criado_em"?: string,"id"?: never,"modelo"?: string | null,"motorista_id"?: string | null,"placa": string
                  }
                  Update: {
                    "criado_em"?: string,"id"?: never,"modelo"?: string | null,"motorista_id"?: string | null,"placa"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "veiculos_motorista_id_fkey"
      columns: ["motorista_id"]
isOneToOne: true
      referencedRelation: "funcionarios"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Views: {
            "servicos_situacao": {
                  Row: {
                    "aceito_em": string | null,"atrasado": boolean | null,"concluido_em": string | null,"criado_em": string | null,"criado_por": string | null,"data_servico": string | null,"empresa_id": number | null,"id": number | null,"motorista_id": string | null,"observacao": string | null,"situacao": string | null,"status": Database["public"]['Enums']["status_servico"] | null,"tipo": Database["public"]['Enums']["tipo_servico"] | null
                  }
                  ComputedFields: never
                  Insert: {
                           "aceito_em"?: string | null,"atrasado"?: never,"concluido_em"?: string | null,"criado_em"?: string | null,"criado_por"?: string | null,"data_servico"?: string | null,"empresa_id"?: number | null,"id"?: number | null,"motorista_id"?: string | null,"observacao"?: string | null,"situacao"?: never,"status"?: Database["public"]['Enums']["status_servico"] | null,"tipo"?: Database["public"]['Enums']["tipo_servico"] | null
                         }
                        Update: {
                           "aceito_em"?: string | null,"atrasado"?: never,"concluido_em"?: string | null,"criado_em"?: string | null,"criado_por"?: string | null,"data_servico"?: string | null,"empresa_id"?: number | null,"id"?: number | null,"motorista_id"?: string | null,"observacao"?: string | null,"situacao"?: never,"status"?: Database["public"]['Enums']["status_servico"] | null,"tipo"?: Database["public"]['Enums']["tipo_servico"] | null
                         }
                        Relationships: [
                    {
      foreignKeyName: "servicos_criado_por_fkey"
      columns: ["criado_por"]
isOneToOne: false
      referencedRelation: "funcionarios"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "servicos_empresa_id_fkey"
      columns: ["empresa_id"]
isOneToOne: false
      referencedRelation: "empresas"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "servicos_motorista_id_fkey"
      columns: ["motorista_id"]
isOneToOne: false
      referencedRelation: "funcionarios"
      referencedColumns: ["id"]
    }
                  ]
                },"ultimas_localizacoes": {
                  Row: {
                    "id": number | null,"latitude": number | null,"longitude": number | null,"motorista_id": string | null,"precisao_m": number | null,"registrado_em": string | null,"velocidade_ms": number | null
                  }
                  ComputedFields: never
                  Relationships: [
                    {
      foreignKeyName: "localizacoes_motorista_id_fkey"
      columns: ["motorista_id"]
isOneToOne: false
      referencedRelation: "funcionarios"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Functions: {
            "iniciar_rota":
{ Args: Record<PropertyKey, never>; Returns: {
              "aceito_em": string | null,
"concluido_em": string | null,
"criado_em": string,
"criado_por": string | null,
"data_servico": string,
"empresa_id": number,
"id": number,
"motorista_id": string,
"observacao": string | null,
"status": Database["public"]['Enums']["status_servico"],
"tipo": Database["public"]['Enums']["tipo_servico"]
            }[]
                          SetofOptions: {
        from: "*"
        to: "servicos"
        isOneToOne: false
        isSetofReturn: true
      } }
          }
          Enums: {
            "perfil_funcionario": "motorista"|"escritorio","status_servico": "pendente"|"em_rota"|"realizada","tipo_servico": "coleta"|"entrega"
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
      Row: infer R
    }
    ? R
    : never
  : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
  ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
  : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "graphql_public": {
          Enums: {
            
          }
        },"public": {
          Enums: {
            "perfil_funcionario": ["motorista", "escritorio"],"status_servico": ["pendente", "em_rota", "realizada"],"tipo_servico": ["coleta", "entrega"]
          }
        }
} as const
