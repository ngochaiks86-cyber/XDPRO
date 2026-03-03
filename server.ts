import express from "express";
import { createServer as createViteServer } from "vite";
import Database from "better-sqlite3";
import path from "path";

const db = new Database("construction.db");

// Initialize Database
db.exec(`
  CREATE TABLE IF NOT EXISTS projects (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    budget REAL DEFAULT 0,
    start_date TEXT,
    status TEXT DEFAULT 'active',
    image_url TEXT
  );

  CREATE TABLE IF NOT EXISTS expenses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER NOT NULL,
    category TEXT NOT NULL, -- 'labor', 'contracted_labor', 'raw_material', 'finishing_material'
    description TEXT NOT NULL,
    amount REAL NOT NULL,
    quantity REAL,
    unit TEXT,
    date TEXT NOT NULL,
    FOREIGN KEY (project_id) REFERENCES projects (id)
  );

  CREATE TABLE IF NOT EXISTS project_photos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER NOT NULL,
    image_url TEXT NOT NULL,
    description TEXT,
    date TEXT NOT NULL,
    FOREIGN KEY (project_id) REFERENCES projects (id)
  );

  CREATE TABLE IF NOT EXISTS expense_payments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    expense_id INTEGER NOT NULL,
    amount REAL NOT NULL,
    note TEXT,
    date TEXT NOT NULL,
    FOREIGN KEY (expense_id) REFERENCES expenses (id)
  );

  CREATE TABLE IF NOT EXISTS owner_payments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER NOT NULL,
    amount REAL NOT NULL,
    note TEXT,
    date TEXT NOT NULL,
    FOREIGN KEY (project_id) REFERENCES projects (id)
  );
`);

// Migration: Add image_url to projects if it doesn't exist
const tableInfo = db.prepare("PRAGMA table_info(projects)").all();
const hasImageUrl = tableInfo.some((col: any) => col.name === 'image_url');
if (!hasImageUrl) {
  db.exec("ALTER TABLE projects ADD COLUMN image_url TEXT");
}

// Migration: Add quantity and unit to expenses if they don't exist
const expenseTableInfo = db.prepare("PRAGMA table_info(expenses)").all();
const hasQuantity = expenseTableInfo.some((col: any) => col.name === 'quantity');
if (!hasQuantity) {
  db.exec("ALTER TABLE expenses ADD COLUMN quantity REAL");
  db.exec("ALTER TABLE expenses ADD COLUMN unit TEXT");
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '50mb' }));

  // API Routes
  app.get("/api/projects", (req, res) => {
    const projects = db.prepare("SELECT * FROM projects").all();
    res.json(projects);
  });

  app.post("/api/projects", (req, res) => {
    const { name, budget, start_date, image_url } = req.body;
    const info = db.prepare("INSERT INTO projects (name, budget, start_date, image_url) VALUES (?, ?, ?, ?)").run(name, budget, start_date, image_url);
    res.json({ id: info.lastInsertRowid });
  });

  app.put("/api/projects/:id", (req, res) => {
    const { name, budget, start_date, image_url } = req.body;
    db.prepare("UPDATE projects SET name = ?, budget = ?, start_date = ?, image_url = ? WHERE id = ?")
      .run(name, budget, start_date, image_url, req.params.id);
    res.json({ success: true });
  });

  app.get("/api/projects/:id", (req, res) => {
    const project = db.prepare("SELECT * FROM projects WHERE id = ?").get(req.params.id);
    const expenses = db.prepare("SELECT * FROM expenses WHERE project_id = ?").all(req.params.id);
    const photos = db.prepare("SELECT * FROM project_photos WHERE project_id = ? ORDER BY date DESC").all(req.params.id);
    const owner_payments = db.prepare("SELECT * FROM owner_payments WHERE project_id = ? ORDER BY date DESC").all(req.params.id);
    
    // For each expense, get its payments
    const expensesWithPayments = expenses.map(exp => {
      const payments = db.prepare("SELECT * FROM expense_payments WHERE expense_id = ?").all(exp.id);
      return { ...exp, payments };
    });

    res.json({ ...project, expenses: expensesWithPayments, photos, owner_payments });
  });

  app.post("/api/expenses", (req, res) => {
    const { project_id, category, description, amount, quantity, unit, date } = req.body;
    const info = db.prepare("INSERT INTO expenses (project_id, category, description, amount, quantity, unit, date) VALUES (?, ?, ?, ?, ?, ?, ?)").run(project_id, category, description, amount, quantity, unit, date);
    res.json({ id: info.lastInsertRowid });
  });

  app.put("/api/expenses/:id", (req, res) => {
    const { category, description, amount, quantity, unit, date } = req.body;
    db.prepare("UPDATE expenses SET category = ?, description = ?, amount = ?, quantity = ?, unit = ?, date = ? WHERE id = ?")
      .run(category, description, amount, quantity, unit, date, req.params.id);
    res.json({ success: true });
  });

  app.post("/api/expenses/:id/payments", (req, res) => {
    const { amount, note, date } = req.body;
    const info = db.prepare("INSERT INTO expense_payments (expense_id, amount, note, date) VALUES (?, ?, ?, ?)")
      .run(req.params.id, amount, note, date);
    res.json({ id: info.lastInsertRowid });
  });

  app.post("/api/projects/:id/owner-payments", (req, res) => {
    const { amount, note, date } = req.body;
    const info = db.prepare("INSERT INTO owner_payments (project_id, amount, note, date) VALUES (?, ?, ?, ?)")
      .run(req.params.id, amount, note, date);
    res.json({ id: info.lastInsertRowid });
  });

  app.delete("/api/owner-payments/:id", (req, res) => {
    db.prepare("DELETE FROM owner_payments WHERE id = ?").run(req.params.id);
    res.json({ success: true });
  });

  app.put("/api/owner-payments/:id", (req, res) => {
    const { amount, note, date } = req.body;
    db.prepare("UPDATE owner_payments SET amount = ?, note = ?, date = ? WHERE id = ?")
      .run(amount, note, date, req.params.id);
    res.json({ success: true });
  });

  app.delete("/api/expense-payments/:id", (req, res) => {
    db.prepare("DELETE FROM expense_payments WHERE id = ?").run(req.params.id);
    res.json({ success: true });
  });

  app.post("/api/projects/:id/photos", (req, res) => {
    const { image_url, description, date } = req.body;
    const info = db.prepare("INSERT INTO project_photos (project_id, image_url, description, date) VALUES (?, ?, ?, ?)")
      .run(req.params.id, image_url, description, date);
    res.json({ id: info.lastInsertRowid });
  });

  app.delete("/api/photos/:id", (req, res) => {
    db.prepare("DELETE FROM project_photos WHERE id = ?").run(req.params.id);
    res.json({ success: true });
  });

  app.delete("/api/expenses/:id", (req, res) => {
    try {
      const { id } = req.params;
      console.log(`Deleting expense ${id}`);
      db.prepare("DELETE FROM expense_payments WHERE expense_id = ?").run(id);
      db.prepare("DELETE FROM expenses WHERE id = ?").run(id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting expense:", error);
      res.status(500).json({ error: "Failed to delete expense" });
    }
  });

  app.delete("/api/projects/:id", (req, res) => {
    try {
      const { id } = req.params;
      // Delete all expense payments for all expenses of this project
      db.prepare(`
        DELETE FROM expense_payments 
        WHERE expense_id IN (SELECT id FROM expenses WHERE project_id = ?)
      `).run(id);
      
      // Delete all expenses of this project
      db.prepare("DELETE FROM expenses WHERE project_id = ?").run(id);
      
      // Delete all photos of this project
      db.prepare("DELETE FROM project_photos WHERE project_id = ?").run(id);
      
      // Delete all owner payments of this project
      db.prepare("DELETE FROM owner_payments WHERE project_id = ?").run(id);
      
      // Finally delete the project
      db.prepare("DELETE FROM projects WHERE id = ?").run(id);
      
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting project:", error);
      res.status(500).json({ error: "Failed to delete project" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.join(__dirname, "dist", "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
