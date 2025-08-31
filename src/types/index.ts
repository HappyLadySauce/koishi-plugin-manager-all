export interface Config {
  groupManagement: {
    autoApprove: boolean
    useWhitelist: boolean
    autoRejectNonWhitelist: boolean
    useKeywordFilter: boolean
    useNameValidation: boolean
    enableWelcome: boolean
    welcomeMessage: string
    rejectionMessage: string
    nameValidationMessage: string
  }
  whitelist: string[]
  nameWhitelist: string[]
  approvalKeywords: string[]
  rejectionKeywords: string[]
  messageMonitor: {
    enabled: boolean
    logLevel: 'info' | 'warn' | 'error'
  }
  database: {
    enabled: boolean
    tableName: string
  }
}

export interface GroupRequestSession {
  guildId?: string
  groupId?: string
  userId?: string
  user_id?: string
  messageId?: string
  flag?: string
  content?: string
  comment?: string
  type?: string
  subtype?: string
  platform?: string
  bot?: any
  approve?: () => Promise<void>
  reject?: (message?: string) => Promise<void>
}

export interface ApprovalResult {
  shouldApprove: boolean
  reason: string
  rejectionMessage?: string
}

export interface ValidationResult {
  success: string[]
  duplicate: string[]
  invalid?: string[]
}

export interface RuleCondition {
  type: 'userId' | 'name' | 'keyword' | 'database' | 'custom'
  value: any
  operator?: 'equals' | 'contains' | 'matches' | 'in' | 'not_in'
}

export interface Rule {
  id: string
  name: string
  priority: number
  enabled: boolean
  condition: RuleCondition
  action: 'approve' | 'reject' | 'ignore'
  message?: string
  description?: string
}