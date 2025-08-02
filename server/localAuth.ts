import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { Express, RequestHandler } from "express";
import session from "express-session";
import bcrypt from "bcrypt";
import connectPg from "connect-pg-simple";
import { storage } from "./storage";
import { User } from "@shared/schema";

declare global {
  namespace Express {
    interface User extends User {}
  }
}

export function getSession() {
  const sessionTtl = 7 * 24 * 60 * 60 * 1000; // 1 week
  const pgStore = connectPg(session);
  const sessionStore = new pgStore({
    conString: process.env.DATABASE_URL,
    createTableIfMissing: true,
    ttl: sessionTtl,
    tableName: "sessions",
  });
  
  return session({
    secret: process.env.SESSION_SECRET || 'fallback-secret-key',
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: false, // Set to true in production with HTTPS
      maxAge: sessionTtl,
    },
  });
}

export async function setupLocalAuth(app: Express) {
  app.set("trust proxy", 1);
  app.use(getSession());
  app.use(passport.initialize());
  app.use(passport.session());

  // Import and setup OAuth strategies
  const { setupOAuthAuth } = await import('./oauthAuth');
  await setupOAuthAuth(app);

  // Configure passport local strategy
  passport.use(
    new LocalStrategy(
      {
        usernameField: 'email',
        passwordField: 'password'
      },
      async (email, password, done) => {
        try {
          const user = await storage.getUserByEmail(email);
          if (!user) {
            return done(null, false, { message: 'Invalid email or password' });
          }

          // Compare password - handle missing password field
          if (!user.password) {
            return done(null, false, { message: 'Invalid email or password' });
          }
          
          const isValid = await bcrypt.compare(password, user.password);
          if (!isValid) {
            return done(null, false, { message: 'Invalid email or password' });
          }

          return done(null, user);
        } catch (error) {
          return done(error);
        }
      }
    )
  );

  passport.serializeUser((user, done) => {
    done(null, user.id);
  });

  passport.deserializeUser(async (id: string, done) => {
    try {
      const user = await storage.getUser(id);
      done(null, user);
    } catch (error) {
      done(error);
    }
  });

  // Login route
  app.post("/api/login", passport.authenticate("local"), (req, res) => {
    res.json({ message: "Login successful", user: req.user });
  });

  // Register route
  app.post("/api/register", async (req, res) => {
    try {
      const { firstName, lastName, email, password, legalOrganizationId } = req.body;
      
      // Check if user already exists
      const existingUser = await storage.getUserByEmail(email);
      if (existingUser) {
        return res.status(400).json({ message: "User with this email already exists" });
      }
      
      // Hash password
      const hashedPassword = await bcrypt.hash(password, 10);
      
      // Create user
      const user = await storage.createUser({
        firstName,
        lastName,
        email,
        password: hashedPassword,
        legalOrganizationId: legalOrganizationId || null,
        authProvider: "local",
      });
      
      // Log the user in after registration
      req.login(user, (err) => {
        if (err) {
          return res.status(500).json({ message: "Registration successful but login failed" });
        }
        res.status(201).json({ message: "Registration successful", user });
      });
    } catch (error) {
      console.error("Error creating user:", error);
      res.status(500).json({ message: "Failed to create user" });
    }
  });

  // Logout route
  app.post("/api/logout", (req, res) => {
    req.logout((err) => {
      if (err) {
        return res.status(500).json({ message: "Logout failed" });
      }
      res.json({ message: "Logout successful" });
    });
  });
}

export const isAuthenticated: RequestHandler = (req, res, next) => {
  if (req.isAuthenticated()) {
    return next();
  }
  res.status(401).json({ message: "Unauthorized" });
};