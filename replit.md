# Overview

DocuFlow is an AI-powered document management system built for legal and business document workflows. The application provides secure case-based document organization with role-based access control, allowing users to create cases, upload PDF documents, and manage access permissions across different user roles (DISCLOSER, REVIEWER, DISCLOSEE, CASEADMIN). 

The system features AI-powered Banking document analysis that automatically extracts financial metadata and generates CSV files from PDF uploads, organizing documents with hierarchical numbering (B1, B1.1, B1.2, etc.).

# User Preferences

Preferred communication style: Simple, everyday language.

# System Architecture

## Frontend Architecture
- **Framework**: React with TypeScript using Vite as the build tool
- **UI Components**: Radix UI primitives with shadcn/ui component library
- **Styling**: Tailwind CSS with CSS variables for theming support
- **State Management**: TanStack Query (React Query) for server state management
- **Routing**: Wouter for client-side routing
- **Form Handling**: React Hook Form with Zod validation

## Backend Architecture
- **Runtime**: Node.js with Express.js framework
- **Language**: TypeScript with ES modules
- **API Pattern**: RESTful API with file upload capabilities using Multer
- **Session Management**: Express sessions with PostgreSQL session store
- **Error Handling**: Centralized error handling middleware with structured error responses

## Data Storage
- **Database**: PostgreSQL with Drizzle ORM for type-safe database operations
- **Connection Pool**: Neon serverless PostgreSQL connection pooling
- **Schema Management**: Drizzle Kit for migrations and schema management
- **File Storage**: Local filesystem storage for uploaded PDF documents

## Authentication & Authorization
- **Authentication Provider**: Replit OpenID Connect (OIDC) integration
- **Session Storage**: PostgreSQL-backed sessions with connect-pg-simple
- **Authorization**: Role-based access control with enum-defined roles
- **Security**: HTTP-only cookies with secure session management

## Document Management
- **File Types**: PDF-only document uploads with 50MB size limit
- **Organization**: Hierarchical categorization (REAL_PROPERTY, BANKING)
- **Access Control**: Case-based permissions with user role assignments
- **File Operations**: Upload, download, and metadata management
- **AI Processing**: Automatic Banking document analysis with OpenAI GPT-4o
- **CSV Generation**: Automatic extraction of transaction data into downloadable CSV files
- **Hierarchical Numbering**: Documents organized by category with comprehensive numbering system:
  - A) Real Property: A1, A2, A3...
  - B) Banking: B1 (account holders), B1.1/B1.2 (individual documents)
  - C) Taxation: C1, C2, C3...
  - D) Superannuation: D1, D2, D3...
  - E) Employment: E1, E2, E3...
  - F) Shares/Investments: F1, F2, F3...
  - G) Vehicles: G1, G2, G3...

## Case Management
- **Case Creation**: Unique case number generation with creator assignment
- **Status Tracking**: Enum-based status system (ACTIVE, UNDER_REVIEW, IN_PROGRESS, COMPLETED, ARCHIVED)
- **User Association**: Many-to-many relationship between users and cases with role assignments
- **Document Association**: One-to-many relationship between cases and documents

# Recent Changes

## August 2, 2025
- **Case Member Management System**: Implemented comprehensive case member management with user assignment and email invitation capabilities. Case admins can now add existing users to cases with specific roles or invite new users via email.
- **Extended Database Schema**: Added caseInvitations table to support email-based user invitations to cases with token-based acceptance system. Extended storage interface with methods for managing case members, invitations, and role assignments.
- **Case Member Management UI**: Created comprehensive case member management component with table-based user listing, role assignment, invitation system, and pending invitation tracking. Users can have multiple roles simultaneously.
- **File Size Tracking**: Added total file size calculation and display functionality for case storage usage tracking. Dashboard case cards now show both document count and total storage size.
- **API Routes Enhancement**: Added new API endpoints for case member management including /api/cases/:id/members, /api/cases/:id/invite, /api/cases/:id/invitations, and /api/users for comprehensive case user management.
- **UI Components**: Created reusable Table and Badge components following shadcn/ui patterns for consistent user interface elements.
- **SendGrid Integration Ready**: Framework prepared for SendGrid email invitation system with proper error handling and token-based invitation acceptance flow.
- **User Management System**: Implemented comprehensive user signup with first name, surname, email, password collection
- **Legal Organizations**: Created 30 WA family law firms database including Hickman Family Law, plus "Self Represented" and "Not Applicable" options
- **Autocomplete Organization Selector**: Built intelligent autocomplete component allowing search of existing organizations or creation of new ones
- **Sample User Creation**: Seeded 30 sample users with 10 tied to legal organizations and varying authentication providers
- **OAuth Integration Framework**: Added support infrastructure for Google, Facebook, and GitHub OAuth authentication
- **Database Schema Enhancement**: Extended users table with legal organization relationships and authentication provider tracking
- **Signup UI Components**: Created responsive signup form with legal organization selector and oauth buttons

## August 1, 2025
- **Fixed Case Number Validation**: Updated case number validation to allow forward slashes (/) in case numbers like "12222/2025"
- **Enhanced UI Layout**: Moved disclosure PDF manager to right-hand panel with navigation controls to preserve document tree functionality
- **Logo Integration**: Added Family Court Doco logo throughout application (landing page, sidebar, PDF documents)
- **PDF Generation**: Fixed jsPDF constructor issues and integrated logo into generated disclosure PDFs
- **Enhanced Case Cards**: Installed framer-motion dependency and implemented TiltedCard component for interactive case cards with 3D tilt effects and hover animations
- **Expanded Disclosure Tree**: Extended document categorization system to include 7 categories: Real Property (A), Banking (B), Taxation (C), Superannuation (D), Employment (E), Shares/Investments (F), and Vehicles (G) with hierarchical numbering system
- **Case Title Field**: Added required case title field during case creation (e.g., "Smith J & Smith M") with database schema updates and form validation
- **Activity Tracking System**: Implemented comprehensive activity logging with database storage for case creation, document uploads, and user actions. Real-time activity feed displays recent user actions across all accessible cases on the dashboard

# External Dependencies

## Database Services
- **Neon Database**: Serverless PostgreSQL hosting with connection pooling
- **connect-pg-simple**: PostgreSQL session store for Express sessions

## Authentication Services
- **Replit Auth**: OpenID Connect provider for user authentication
- **Passport.js**: Authentication middleware with OpenID Connect strategy

## UI & Styling
- **Radix UI**: Headless UI components for accessibility and functionality
- **Tailwind CSS**: Utility-first CSS framework with custom design system
- **Lucide React**: Icon library for consistent iconography

## Development Tools
- **Vite**: Build tool with development server and HMR
- **Replit Plugins**: Development environment integration (@replit/vite-plugin-cartographer, @replit/vite-plugin-runtime-error-modal)
- **TypeScript**: Type checking and development tooling

## Validation & Forms
- **Zod**: Runtime type validation and schema definition
- **React Hook Form**: Form state management and validation integration
- **@hookform/resolvers**: Zod resolver for form validation

## File Processing
- **Multer**: Multipart form data handling for file uploads
- **File System**: Node.js fs module for local file operations