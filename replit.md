# Overview

DocuFlow is a document management system built for legal and business document workflows. The application provides secure case-based document organization with role-based access control, allowing users to create cases, upload PDF documents, and manage access permissions across different user roles (DISCLOSER, REVIEWER, DISCLOSEE, CASEADMIN).

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

## Case Management
- **Case Creation**: Unique case number generation with creator assignment
- **Status Tracking**: Enum-based status system (ACTIVE, UNDER_REVIEW, IN_PROGRESS, COMPLETED, ARCHIVED)
- **User Association**: Many-to-many relationship between users and cases with role assignments
- **Document Association**: One-to-many relationship between cases and documents

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