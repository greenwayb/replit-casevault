import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import { Strategy as FacebookStrategy } from "passport-facebook";
import { Strategy as GitHubStrategy } from "passport-github2";
import { Express } from "express";
import { storage } from "./storage";
import { randomUUID } from "crypto";
import { formatUserNames } from "./nameFormattingService.js";

export async function setupOAuthAuth(app: Express) {
  // Google OAuth Strategy
  if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
    passport.use(new GoogleStrategy({
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: "/auth/google/callback"
    }, async (accessToken, refreshToken, profile, done) => {
      try {
        // Check if user exists by email
        let user = await storage.getUserByEmail(profile.emails?.[0]?.value || '');
        
        if (!user) {
          // Format names before creating user
          const { firstName, lastName } = formatUserNames(
            profile.name?.givenName || '',
            profile.name?.familyName || ''
          );
          
          // Create new user
          user = await storage.createUser({
            id: randomUUID(),
            firstName,
            lastName,
            email: profile.emails?.[0]?.value || '',
            password: '', // OAuth users don't need passwords
            authProvider: 'google',
            profileImageUrl: profile.photos?.[0]?.value,
            legalOrganizationId: null,
          });
        }
        
        return done(null, user);
      } catch (error) {
        return done(error);
      }
    }));

    // Google OAuth routes
    app.get('/auth/google', 
      passport.authenticate('google', { scope: ['profile', 'email'] })
    );

    app.get('/auth/google/callback',
      passport.authenticate('google', { failureRedirect: '/auth' }),
      (req, res) => {
        res.redirect('/'); // Redirect to dashboard on success
      }
    );
  }

  // Facebook OAuth Strategy
  if (process.env.FACEBOOK_APP_ID && process.env.FACEBOOK_APP_SECRET) {
    passport.use(new FacebookStrategy({
      clientID: process.env.FACEBOOK_APP_ID,
      clientSecret: process.env.FACEBOOK_APP_SECRET,
      callbackURL: "/auth/facebook/callback",
      profileFields: ['id', 'emails', 'name', 'picture']
    }, async (accessToken, refreshToken, profile, done) => {
      try {
        let user = await storage.getUserByEmail(profile.emails?.[0]?.value || '');
        
        if (!user) {
          // Format names before creating user
          const { firstName, lastName } = formatUserNames(
            profile.name?.givenName || '',
            profile.name?.familyName || ''
          );
          
          user = await storage.createUser({
            id: randomUUID(),
            firstName,
            lastName,
            email: profile.emails?.[0]?.value || '',
            password: '',
            authProvider: 'facebook',
            profileImageUrl: profile.photos?.[0]?.value,
            legalOrganizationId: null,
          });
        }
        
        return done(null, user);
      } catch (error) {
        return done(error);
      }
    }));

    // Facebook OAuth routes
    app.get('/auth/facebook',
      passport.authenticate('facebook', { scope: ['email'] })
    );

    app.get('/auth/facebook/callback',
      passport.authenticate('facebook', { failureRedirect: '/auth' }),
      (req, res) => {
        res.redirect('/');
      }
    );
  }

  // GitHub OAuth Strategy
  if (process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET) {
    passport.use(new GitHubStrategy({
      clientID: process.env.GITHUB_CLIENT_ID,
      clientSecret: process.env.GITHUB_CLIENT_SECRET,
      callbackURL: "/auth/github/callback"
    }, async (accessToken, refreshToken, profile, done) => {
      try {
        let user = await storage.getUserByEmail(profile.emails?.[0]?.value || '');
        
        if (!user) {
          // Format names before creating user
          const displayNameParts = profile.displayName?.split(' ') || [];
          const { firstName, lastName } = formatUserNames(
            displayNameParts[0] || '',
            displayNameParts.slice(1).join(' ') || ''
          );
          
          user = await storage.createUser({
            id: randomUUID(),
            firstName,
            lastName,
            email: profile.emails?.[0]?.value || '',
            password: '',
            authProvider: 'github',
            profileImageUrl: profile.photos?.[0]?.value,
            legalOrganizationId: null,
          });
        }
        
        return done(null, user);
      } catch (error) {
        return done(error);
      }
    }));

    // GitHub OAuth routes
    app.get('/auth/github',
      passport.authenticate('github', { scope: ['user:email'] })
    );

    app.get('/auth/github/callback',
      passport.authenticate('github', { failureRedirect: '/auth' }),
      (req, res) => {
        res.redirect('/');
      }
    );
  }
}