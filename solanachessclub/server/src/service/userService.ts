import { Knex } from 'knex';
import knexInstance from '../db/knex'; // Assuming knex instance is exported from here

interface UserServiceError {
  message: string;
  statusCode?: number;
}

/**
 * Deletes a user account and all associated data.
 * This function performs operations within a database transaction.
 *
 * @param userId - The ID of the user to delete.
 * @returns Promise<void>
 * @throws Error if deletion fails.
 */
export async function deleteUserAccount(userId: string): Promise<void> {
  console.log(`[UserService deleteUserAccount] Function invoked with userId: ${userId}`);

  if (!userId) {
    console.error('[UserService deleteUserAccount] Error: User ID is undefined or null at function entry.');
    throw new Error('User ID is required to delete an account.');
  }

  console.log(`[UserService] Attempting to delete account for user ID: ${userId}`);

  try {
    await knexInstance.transaction(async (trx) => {
      // Step 1: (Placeholder) Identify external files for deletion before DB operations.
      // e.g., profile pictures from cloud storage, attachments.
      // This list should be compiled here and files deleted after successful DB transaction or handled separately.
      console.log(`[UserService] TODO: Implement logic to identify external files for user ${userId}`);

      // Step 2: Delete the user from the 'users' table.
      // ON DELETE CASCADE on foreign keys in 'posts', 'follows', 'user_wallets',
      // 'chat_participants', and 'chat_messages' will handle deletion of related data.
      const deletedUserRows = await trx('users').where({ id: userId }).del();

      if (deletedUserRows === 0) {
        // This could mean the user was already deleted or never existed.
        // For idempotency, we might not want to throw an error here but log it.
        console.warn(`[UserService] User with ID ${userId} not found for deletion, or already deleted.`);
        // Depending on desired behavior, you could throw an error:
        // throw { message: 'User not found', statusCode: 404 };
      }

      console.log(`[UserService] Successfully deleted user record (and cascaded data) for user ID: ${userId}`);

      // Step 3: (Placeholder) Clean up orphaned chat rooms if necessary.
      // e.g., if a direct chat room becomes empty.
      console.log(`[UserService] TODO: Implement logic to clean up orphaned chat rooms related to user ${userId}`);
      
      // Step 4: (Placeholder) Delete external files identified in Step 1.
      // This should happen after DB operations are confirmed successful.
      console.log(`[UserService] TODO: Implement deletion of external files for user ${userId}`);
    });

    console.log(`[UserService] Account deletion process completed successfully for user ID: ${userId}`);

  } catch (error) {
    const serviceError = error as UserServiceError;
    console.error(`[UserService] Error deleting user account for ID ${userId}:`, serviceError.message, serviceError);
    // Re-throw a generic error or a more specific one if statusCode is available
    throw new Error(`Failed to delete account: ${serviceError.message || 'Internal server error'}`);
  }
} 