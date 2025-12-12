/**
 * Mock user data for frontend development and testing
 * This data matches the table design requirements with all required fields
 */

export interface MockUser {
  id: number | string
  name: string
  email: string
  phoneNumber: string
  role: 'Editor' | 'View only' | 'Approval' | 'ADMIN_USER' | 'NORMAL_USER' | 'API_USER'
  status: 'Active' | 'Deactivate'
}

export const mockUsers: MockUser[] = [
  {
    id: 'Prolos 1',
    name: 'Prolos 2',
    email: 'Prolos 3',
    phoneNumber: 'Prolos 4',
    role: 'Editor',
    status: 'Active',
  },
  {
    id: 'Prolos 1',
    name: 'Prolos 2',
    email: 'Prolos 3',
    phoneNumber: 'Prolos 4',
    role: 'View only',
    status: 'Deactivate',
  },
  {
    id: 'Prolos 1',
    name: 'Prolos 2',
    email: 'Prolos 3',
    phoneNumber: 'Prolos 4',
    role: 'Approval',
    status: 'Active',
  },
  {
    id: 'Prolos 1',
    name: 'Prolos 2',
    email: 'Prolos 3',
    phoneNumber: 'Prolos 4',
    role: 'Editor',
    status: 'Active',
  },
  {
    id: 'Prolos 1',
    name: 'Prolos 2',
    email: 'Prolos 3',
    phoneNumber: 'Prolos 4',
    role: 'Editor',
    status: 'Active',
  },
  {
    id: 'Prolos 1',
    name: 'Prolos 2',
    email: 'Prolos 3',
    phoneNumber: 'Prolos 4',
    role: 'Editor',
    status: 'Active',
  },
]

/**
 * More realistic mock user data (optional - for better testing)
 */
export const realisticMockUsers: MockUser[] = [
  {
    id: 1,
    name: 'John Doe',
    email: 'john.doe@example.com',
    phoneNumber: '+855 12 345 678',
    role: 'Editor',
    status: 'Active',
  },
  {
    id: 2,
    name: 'Jane Smith',
    email: 'jane.smith@example.com',
    phoneNumber: '+855 12 345 679',
    role: 'View only',
    status: 'Deactivate',
  },
  {
    id: 3,
    name: 'Bob Johnson',
    email: 'bob.johnson@example.com',
    phoneNumber: '+855 12 345 680',
    role: 'Approval',
    status: 'Active',
  },
  {
    id: 4,
    name: 'Alice Williams',
    email: 'alice.williams@example.com',
    phoneNumber: '+855 12 345 681',
    role: 'Editor',
    status: 'Active',
  },
  {
    id: 5,
    name: 'Charlie Brown',
    email: 'charlie.brown@example.com',
    phoneNumber: '+855 12 345 682',
    role: 'Editor',
    status: 'Active',
  },
  {
    id: 6,
    name: 'Diana Prince',
    email: 'diana.prince@example.com',
    phoneNumber: '+855 12 345 683',
    role: 'Editor',
    status: 'Active',
  },
]
