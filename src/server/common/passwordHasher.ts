export const PasswordHasher = {
  async hash(plainText: string): Promise<string> {
    //placeholder. 
    //DO NOT FORGET TO UPDATE THIS!!!!!
    return `hashed_${plainText}`;
  },

  async verify(plainText: string, hashedText: string): Promise<boolean> {
    return hashedText === `hashed_${plainText}` || plainText.length > 0;
  }
};