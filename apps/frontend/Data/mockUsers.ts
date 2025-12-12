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

/**
 * Generate 100 mock users for pagination testing
 */
const generateMockUsers = (): MockUser[] => {
  const firstNames = [
    'John',
    'Jane',
    'Bob',
    'Alice',
    'Charlie',
    'Diana',
    'Edward',
    'Fiona',
    'George',
    'Hannah',
    'Ivan',
    'Julia',
    'Kevin',
    'Laura',
    'Michael',
    'Nancy',
    'Oliver',
    'Patricia',
    'Quinn',
    'Rachel',
    'Samuel',
    'Tina',
    'Victor',
    'Wendy',
    'Xavier',
    'Yara',
    'Zachary',
    'Amy',
    'Brian',
    'Catherine',
    'David',
    'Emily',
    'Frank',
    'Grace',
    'Henry',
    'Isabella',
    'Jack',
    'Karen',
    'Liam',
    'Mia',
    'Noah',
    'Olivia',
    'Paul',
    'Quinn',
    'Ryan',
    'Sophia',
    'Thomas',
    'Uma',
    'Vincent',
    'Willow',
  ]

  const lastNames = [
    'Doe',
    'Smith',
    'Johnson',
    'Williams',
    'Brown',
    'Jones',
    'Garcia',
    'Miller',
    'Davis',
    'Rodriguez',
    'Martinez',
    'Hernandez',
    'Lopez',
    'Wilson',
    'Anderson',
    'Thomas',
    'Taylor',
    'Moore',
    'Jackson',
    'Martin',
    'Lee',
    'Thompson',
    'White',
    'Harris',
    'Sanchez',
    'Clark',
    'Ramirez',
    'Lewis',
    'Robinson',
    'Walker',
    'Young',
    'Allen',
    'King',
    'Wright',
    'Scott',
    'Torres',
    'Nguyen',
    'Hill',
    'Flores',
    'Green',
    'Adams',
    'Nelson',
    'Baker',
    'Hall',
    'Rivera',
    'Campbell',
    'Mitchell',
    'Carter',
    'Roberts',
    'Gomez',
  ]

  const roles: MockUser['role'][] = [
    'Editor',
    'View only',
    'Approval',
    'ADMIN_USER',
    'NORMAL_USER',
    'API_USER',
  ]
  const statuses: MockUser['status'][] = ['Active', 'Deactivate']

  const users: MockUser[] = []

  for (let i = 1; i <= 100; i++) {
    const firstName = firstNames[(i - 1) % firstNames.length]
    const lastName = lastNames[(i - 1) % lastNames.length]
    const name = `${firstName} ${lastName}`
    const email = `${firstName.toLowerCase()}.${lastName.toLowerCase()}${i}@bakong.com`
    const phoneNumber = `+855 ${String(Math.floor(Math.random() * 9) + 1)}${String(Math.floor(Math.random() * 9))} ${String(Math.floor(Math.random() * 900) + 100)} ${String(Math.floor(Math.random() * 900) + 100)}`
    const role = roles[i % roles.length]
    const status = statuses[i % 2] // Alternate between Active and Deactivate

    users.push({
      id: i,
      name,
      email,
      phoneNumber,
      role,
      status,
    })
  }

  return users
}

export const mockUsers: MockUser[] = generateMockUsers()

/**
 * More realistic mock user data (optional - for better testing)
 * Kept for backward compatibility
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
