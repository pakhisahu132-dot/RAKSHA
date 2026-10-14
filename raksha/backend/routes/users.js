import { Router } from "express";
import { users } from "../data/store.js";

const router = Router();

// GET /api/users/:id
router.get("/:id", (req, res) => {
  const user = users.find((u) => u.id === req.params.id);
  if (!user) return res.status(404).json({ error: "User not found" });
  const { trustedContacts, ...rest } = user;
  res.json({ user: { ...rest, trustedContacts: trustedContacts.map(({ telegramChatId, ...c }) => ({ ...c, telegramConfigured: !!telegramChatId })) } });
});

export default router;
