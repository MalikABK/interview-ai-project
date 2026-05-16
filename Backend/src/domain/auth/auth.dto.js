const { z } = require('zod');

const UserDTO = z.object({
    id: z.string(),
    username: z.string(),
    email: z.string().email(),
});

const RegisterDTO = z.object({
    username: z.string().min(3).max(30),
    email: z.string().email(),
    password: z.string().min(8),
});

const LoginDTO = z.object({
    email: z.string().email(),
    password: z.string(),
});

module.exports = {
    UserDTO,
    RegisterDTO,
    LoginDTO
};
