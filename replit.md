# Overview

DocuFlow is an AI-powered document management system designed for legal and business document workflows. It provides secure, case-based document organization with role-based access control (DISCLOSER, REVIEWER, DISCLOSEE, CASEADMIN). Key capabilities include creating cases, uploading PDF documents, and managing access permissions. A core feature is AI-powered Banking document analysis, which extracts financial metadata, generates CSV files from PDF uploads, and organizes documents with a hierarchical numbering system. The system's business vision is to streamline document management and analysis, particularly for legal and financial contexts.

# User Preferences

Preferred communication style: Simple, everyday language.

# System Architecture

## Frontend
- **Framework**: React with TypeScript (Vite build tool)
- **UI Components**: Radix UI primitives, shadcn/ui
- **Styling**: Tailwind CSS with CSS variables
- **State Management**: TanStack Query (React Query)
- **Routing**: Wouter
- **Form Handling**: React Hook Form with Zod validation

## Backend
- **Runtime**: Node.js with Express.js
- **Language**: TypeScript (ES modules)
- **API Pattern**: RESTful API (Multer for file uploads)
- **Session Management**: Express sessions with PostgreSQL store
- **Error Handling**: Centralized middleware with structured responses

## Data Storage
- **Database**: PostgreSQL with Drizzle ORM
- **Connection Pool**: Neon serverless PostgreSQL connection pooling
- **Schema Management**: Drizzle Kit for migrations
- **File Storage**: Local filesystem for PDF documents

## Authentication & Authorization
- **Authentication Provider**: Replit OpenID Connect (OIDC)
- **Session Storage**: PostgreSQL-backed sessions (connect-pg-simple)
- **Authorization**: Role-based access control with enum-defined roles
- **Security**: HTTP-only cookies

## Document Management
- **File Types**: PDF-only (50MB limit)
- **Organization**: Hierarchical categorization (REAL_PROPERTY, BANKING, TAXATION, SUPERANNUATION, EMPLOYMENT, SHARES/INVESTMENTS, VEHICLES) with a comprehensive numbering system (e.g., A1, B1, B1.1)
- **Access Control**: Case-based permissions with user role assignments
- **AI Processing**: Advanced Banking document analysis using Claude Sonnet 4 with enhanced completeness validation, generating comprehensive XML analysis with transaction counting and validation to ensure full document processing.
- **Transaction Completeness**: PDF transaction line estimation with XML validation to detect incomplete analysis and ensure all transactions are captured.
- **Enhanced Error Handling**: Processing failures keep dialog open, log detailed error information to server files, and display log locations to users for debugging.

## Case Management
- **Creation**: Unique case number generation, creator assignment
- **Status Tracking**: Enum-based status system (ACTIVE, UNDER_REVIEW, IN_PROGRESS, COMPLETED, ARCHIVED)
- **User Association**: Many-to-many relationship with role assignments
- **Document Association**: One-to-many relationship
- **Member Management**: Add existing users or invite new users via email with multi-role assignment capabilities.
- **Activity Tracking**: Comprehensive logging of case creation, document uploads, and user actions.

## UI/UX Decisions
- **Branding**: "Family Court Documentation" branding and logo integrated into top navigation and generated PDFs.
- **Interactive Elements**: TiltedCard component for interactive case cards with 3D tilt effects.
- **PDF Preview**: Always-on side-by-side PDF preview with extracted information for verification.
- **Upload Progress**: Dual progress bars showing upload and AI processing phases with visual indicators.
- **Enhanced Sankey Visualization**: Pre-processed period data architecture eliminates recursion issues by computing all period variations upfront and simply swapping datasets when filtering, providing stable interactive banking flow diagrams with summary statistics and analytics.
- **CSV Export Removal**: CSV export functionality completely removed per user request, focusing exclusively on XML-based analysis and visualization.

# External Dependencies

## Database Services
- **Neon Database**: Serverless PostgreSQL hosting
- **connect-pg-simple**: PostgreSQL session store

## Authentication Services
- **Replit Auth**: OpenID Connect provider
- **Passport.js**: Authentication middleware

## UI & Styling
- **Radix UI**: Headless UI components
- **Tailwind CSS**: Utility-first CSS framework
- **Lucide React**: Icon library

## Development Tools
- **Vite**: Build tool
- **Replit Plugins**: Development environment integration
- **TypeScript**: Type checking

## Validation & Forms
- **Zod**: Runtime type validation
- **React Hook Form**: Form state management
- **@hookform/resolvers**: Zod resolver for form validation

## File Processing
- **Multer**: Multipart form data handling
- **File System**: Node.js fs module for local file operations
- **OpenAI GPT-4o**: For AI-powered banking document analysis.