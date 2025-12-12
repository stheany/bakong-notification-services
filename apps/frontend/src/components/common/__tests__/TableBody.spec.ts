import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import TableBody, { type NotificationItem, type UserItem } from '../TableBody.vue'

describe('TableBody', () => {
  const mockNotifications: NotificationItem[] = [
    { id: 1, name: 'Test Notification 1', icon: 'data:image/png;base64,test' },
    { id: 2, name: 'Test Notification 2', icon: 'data:image/png;base64,test2' },
  ]

  const mockUsers: UserItem[] = [
    {
      id: 1,
      name: 'John Doe',
      email: 'john@example.com',
      phoneNumber: '1234567890',
      role: 'ADMIN_USER',
      status: 'Active',
    },
    {
      id: 2,
      name: 'Jane Smith',
      email: 'jane@example.com',
      phoneNumber: '0987654321',
      role: 'NORMAL_USER',
      status: 'Deactivate',
    },
  ]

  describe('Notification Mode', () => {
    it('renders notification table with correct columns', () => {
      const wrapper = mount(TableBody, {
        props: {
          mode: 'notification',
          items: mockNotifications,
        },
      })

      expect(wrapper.find('table').exists()).toBe(true)
      expect(wrapper.find('thead').exists()).toBe(true)
      expect(wrapper.find('tbody').exists()).toBe(true)
    })

    it('displays notification items correctly', () => {
      const wrapper = mount(TableBody, {
        props: {
          mode: 'notification',
          items: mockNotifications,
        },
      })

      expect(wrapper.text()).toContain('Test Notification 1')
      expect(wrapper.text()).toContain('Test Notification 2')
    })

    it('emits view event when view button is clicked', async () => {
      const wrapper = mount(TableBody, {
        props: {
          mode: 'notification',
          items: mockNotifications,
        },
      })

      const viewButtons = wrapper.findAll('button[title="View"]')
      await viewButtons[0].trigger('click')

      expect(wrapper.emitted('view')).toBeTruthy()
      expect(wrapper.emitted('view')?.[0]).toEqual([mockNotifications[0]])
    })

    it('emits edit event when edit button is clicked', async () => {
      const wrapper = mount(TableBody, {
        props: {
          mode: 'notification',
          items: mockNotifications,
        },
      })

      const editButtons = wrapper.findAll('button[title="Edit"]')
      await editButtons[0].trigger('click')

      expect(wrapper.emitted('edit')).toBeTruthy()
      expect(wrapper.emitted('edit')?.[0]).toEqual([mockNotifications[0]])
    })

    it('emits delete event when delete button is clicked', async () => {
      const wrapper = mount(TableBody, {
        props: {
          mode: 'notification',
          items: mockNotifications,
        },
      })

      const deleteButtons = wrapper.findAll('button[title="Delete"]')
      await deleteButtons[0].trigger('click')

      expect(wrapper.emitted('delete')).toBeTruthy()
      expect(wrapper.emitted('delete')?.[0]).toEqual([mockNotifications[0]])
    })

    it('displays empty state when no items', () => {
      const wrapper = mount(TableBody, {
        props: {
          mode: 'notification',
          items: [],
        },
      })

      expect(wrapper.text()).toContain('No notification types found.')
    })

    it('handles checkbox selection', async () => {
      const wrapper = mount(TableBody, {
        props: {
          mode: 'notification',
          items: mockNotifications,
        },
      })

      const checkboxes = wrapper.findAll('input[type="checkbox"]')
      // First checkbox is "select all", second is first item
      await checkboxes[1].trigger('change')

      // Check if item is selected (checkbox should be checked)
      expect(checkboxes[1].element.checked).toBe(true)
    })
  })

  describe('User Mode', () => {
    it('renders user table with correct columns', () => {
      const wrapper = mount(TableBody, {
        props: {
          mode: 'user',
          items: mockUsers,
        },
      })

      expect(wrapper.find('table').exists()).toBe(true)
      expect(wrapper.text()).toContain('ID')
      expect(wrapper.text()).toContain('Name')
      expect(wrapper.text()).toContain('Email')
      expect(wrapper.text()).toContain('Phone Number')
      expect(wrapper.text()).toContain('Role')
      expect(wrapper.text()).toContain('Status')
    })

    it('displays user items correctly', () => {
      const wrapper = mount(TableBody, {
        props: {
          mode: 'user',
          items: mockUsers,
        },
      })

      expect(wrapper.text()).toContain('John Doe')
      expect(wrapper.text()).toContain('john@example.com')
      expect(wrapper.text()).toContain('Jane Smith')
    })

    it('formats role correctly', () => {
      const wrapper = mount(TableBody, {
        props: {
          mode: 'user',
          items: mockUsers,
        },
      })

      // ADMIN_USER should be formatted to "Editor"
      expect(wrapper.text()).toContain('Editor')
      // NORMAL_USER should be formatted to "View only"
      expect(wrapper.text()).toContain('View only')
    })

    it('displays status button correctly', () => {
      const wrapper = mount(TableBody, {
        props: {
          mode: 'user',
          items: mockUsers,
        },
      })

      const statusButtons = wrapper
        .findAll('button')
        .filter((btn) => btn.text().includes('Active') || btn.text().includes('Deactivate'))

      expect(statusButtons.length).toBeGreaterThan(0)
    })

    it('emits statusToggle event when status button is clicked', async () => {
      const wrapper = mount(TableBody, {
        props: {
          mode: 'user',
          items: mockUsers,
        },
      })

      const statusButtons = wrapper
        .findAll('button')
        .filter((btn) => btn.text().includes('Active') || btn.text().includes('Deactivate'))

      await statusButtons[0].trigger('click')

      expect(wrapper.emitted('statusToggle')).toBeTruthy()
      expect(wrapper.emitted('statusToggle')?.[0]?.[0]).toEqual(mockUsers[0])
      expect(wrapper.emitted('statusToggle')?.[0]?.[1]).toBe(0)
    })

    it('displays empty state when no users', () => {
      const wrapper = mount(TableBody, {
        props: {
          mode: 'user',
          items: [],
        },
      })

      expect(wrapper.text()).toContain('No users found.')
    })
  })

  describe('Selection Logic', () => {
    it('selects all items when select all checkbox is clicked', async () => {
      const wrapper = mount(TableBody, {
        props: {
          mode: 'notification',
          items: mockNotifications,
        },
      })

      const selectAllCheckbox = wrapper.find('thead input[type="checkbox"]')
      await selectAllCheckbox.trigger('change')

      const itemCheckboxes = wrapper.findAll('tbody input[type="checkbox"]')
      itemCheckboxes.forEach((checkbox) => {
        expect(checkbox.element.checked).toBe(true)
      })
    })

    it('deselects all items when select all is clicked again', async () => {
      const wrapper = mount(TableBody, {
        props: {
          mode: 'notification',
          items: mockNotifications,
        },
      })

      const selectAllCheckbox = wrapper.find('thead input[type="checkbox"]')
      // Select all
      await selectAllCheckbox.trigger('change')
      // Deselect all
      await selectAllCheckbox.trigger('change')

      const itemCheckboxes = wrapper.findAll('tbody input[type="checkbox"]')
      itemCheckboxes.forEach((checkbox) => {
        expect(checkbox.element.checked).toBe(false)
      })
    })

    it('shows indeterminate state when some items are selected', async () => {
      const wrapper = mount(TableBody, {
        props: {
          mode: 'notification',
          items: mockNotifications,
        },
      })

      // Select only first item
      const itemCheckboxes = wrapper.findAll('tbody input[type="checkbox"]')
      await itemCheckboxes[0].trigger('change')

      const selectAllCheckbox = wrapper.find('thead input[type="checkbox"]')
      // Indeterminate state is set via property, not checked state
      expect(selectAllCheckbox.element.indeterminate).toBe(true)
    })
  })

  describe('Props Validation', () => {
    it('defaults to notification mode when mode is not provided', () => {
      const wrapper = mount(TableBody, {
        props: {
          items: mockNotifications,
        },
      })

      expect(wrapper.props('mode')).toBe('notification')
    })

    it('handles empty items array', () => {
      const wrapper = mount(TableBody, {
        props: {
          mode: 'notification',
          items: [],
        },
      })

      expect(wrapper.find('table').exists()).toBe(true)
      expect(wrapper.text()).toContain('No notification types found.')
    })
  })
})
