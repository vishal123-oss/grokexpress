// In-memory user store (replace with database in production)
const users = new Map();
let nextId = 1;

export const userController = {
  getAllUsers: (req, res) => {
    const userList = Array.from(users.values());
    res.json({ users: userList, count: userList.length });
  },

  getUserById: (req, res) => {
    const { id } = req.params;
    const user = users.get(id);

    if (!user) {
      res.statusCode = 404;
      res.json({ error: 'User not found' });
      return;
    }

    res.json({ user });
  },

  createUser: async (req, res) => {
    const body = await parseBody(req);
    const id = String(nextId++);
    const user = { id, ...body, createdAt: new Date().toISOString() };

    users.set(id, user);
    res.statusCode = 201;
    res.json({ user });
  },

  updateUser: async (req, res) => {
    const { id } = req.params;
    const existingUser = users.get(id);

    if (!existingUser) {
      res.statusCode = 404;
      res.json({ error: 'User not found' });
      return;
    }

    const body = await parseBody(req);
    const updatedUser = { ...existingUser, ...body, updatedAt: new Date().toISOString() };
    users.set(id, updatedUser);

    res.json({ user: updatedUser });
  },

  deleteUser: (req, res) => {
    const { id } = req.params;

    if (!users.has(id)) {
      res.statusCode = 404;
      res.json({ error: 'User not found' });
      return;
    }

    users.delete(id);
    res.statusCode = 204;
    res.end();
  }
};

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (err) {
        reject(err);
      }
    });
    req.on('error', reject);
  });
}
