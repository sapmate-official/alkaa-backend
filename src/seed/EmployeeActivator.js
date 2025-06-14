import axios from 'axios';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

// Base URL for API calls
const BASE_URL = 'http://localhost:3000/api/v1';

// Get current directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Path to user data file
const USER_DATA_PATH = path.join(__dirname, 'data', 'User.json');

/**
 * Utility to activate employees using verification tokens from JSON file
 */
class EmployeeActivator {
  constructor() {
    this.activatedCount = 0;
    this.failedCount = 0;
    this.password = 'password'; // Default password for all employees
  }

  /**
   * Read user data from JSON file
   */
  async readUserData() {
    try {
      const fileData = await fs.readFile(USER_DATA_PATH, 'utf8');
      return JSON.parse(fileData);
    } catch (error) {
      console.error('❌ Error reading user data file:', error.message);
      if (error.code === 'ENOENT') {
        console.error(`File not found: ${USER_DATA_PATH}`);
        console.error('Make sure the data directory exists and contains User.json');
      }
      throw error;
    }
  }

  /**
   * Activate a single user with their verification token
   */
  async activateUser(user) {
    try {
      if (!user.verificationToken) {
        console.warn(`⚠️ No verification token found for employee: ${user.firstName} ${user.lastName}`);
        this.failedCount++;
        return false;
      }

      await axios.post(`${BASE_URL}/general/set-password`, {
        password: this.password,
        verificationToken: user.verificationToken
      });

      console.log(`✅ Activated employee: ${user.firstName} ${user.lastName} (${user.email})`);
      this.activatedCount++;
      return true;
    } catch (error) {
      console.error(`❌ Error activating employee ${user.firstName} ${user.lastName}:`, 
        error.response?.data || error.message);
      this.failedCount++;
      return false;
    }
  }

  /**
   * Run the activation process for all users in the JSON file
   */
  async run() {
    try {
      console.log('🔐 Starting Employee Activator...');
      
      // Read user data from file
      const users = await this.readUserData();
      console.log(`📋 Found ${users.length} users in data file`);
      
      // Process each user
      for (const user of users) {
        await this.activateUser(user);
        
        // Add small delay to avoid overwhelming the server
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      console.log('\n✅ Activation process completed');
      console.log(`📊 Successfully activated: ${this.activatedCount} employees`);
      console.log(`⚠️ Failed to activate: ${this.failedCount} employees`);
      console.log('🔑 All activated employees can login with password:', this.password);
      
    } catch (error) {
      console.error('❌ Error in employee activator:', error.message);
      throw error;
    }
  }
}

  const activator = new EmployeeActivator();
  activator.run()
    .catch((error) => {
      console.error('❌ Employee activation failed!');
      process.exit(1);
    });
