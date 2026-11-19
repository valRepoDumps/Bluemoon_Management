import bcrypt from "bcrypt";

export async function hashPassword(password: string) {
    return bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, hash: string) {
    return bcrypt.compare(password, hash);
}

/*ONLY FOR LOCAL DEVELOPMENT (for seeding stuff), user verifyPassword, hashPassword in actual production*/
export function hashPasswordSync(password: string) {
    return bcrypt.hashSync(password, 10);
}

export function verifyPasswordSync(password: string, hash: string) {
    return bcrypt.compareSync(password, hash);
}