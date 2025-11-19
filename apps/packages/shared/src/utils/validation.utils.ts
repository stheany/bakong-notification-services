export class ValidationUtils {
  static isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    return emailRegex.test(email)
  }

  static isValidPassword(password: string): boolean {
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[a-zA-Z\d@$!%*?&]{8,}$/
    return passwordRegex.test(password)
  }

  static isValidUsername(username: string): boolean {
    // Allow lowercase letters, numbers, underscore, @, and dot (for email format)
    // No spaces, no uppercase letters
    const usernameRegex = /^[a-z0-9_@.]+$/
    return usernameRegex.test(username) && username.length >= 3 && username.length <= 255
  }

  static sanitizeString(input: string): string {
    return input.trim().replace(/[<>]/g, '')
  }

  static isValidUrl(url: string): boolean {
    try {
      new URL(url)
      return true
    } catch {
      return false
    }
  }
}
