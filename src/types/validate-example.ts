import fs from 'fs';
import path from 'path';
import { UserBootDataSchema, type UserBootData } from './index.js';

// Example function to validate the userBootData.json file
export async function validateUserBootData(filePath: string): Promise<UserBootData> {
    try {
        // Read the JSON file
        const fileContent = fs.readFileSync(filePath, 'utf-8');
        const jsonData = JSON.parse(fileContent);

        // Validate against the schema
        const validatedData = UserBootDataSchema.parse(jsonData);

        console.log('✅ UserBootData validation successful!');
        console.log(`Channels count: ${validatedData.channels.length}`);
        console.log(`Workspaces count: ${validatedData.workspaces.length}`);

        return validatedData;
    } catch (error) {
        console.error('❌ Validation failed:', error);
        throw error;
    }
}

// Example usage (commented out to avoid running automatically)
/*
const userBootDataPath = path.join(process.cwd(), 'userBootData.json');
validateUserBootData(userBootDataPath)
  .then(data => {
    console.log('Validation completed successfully');
  })
  .catch(error => {
    console.error('Validation failed:', error);
  });
*/
