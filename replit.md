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

## August 4, 2025 (Latest Updates)
- **Restructured AI Analysis to XML-First Architecture**: Completely redesigned the detailed AI analysis workflow to create XML data first, then use it as the source for all downstream processing (CSV generation, summary analysis, Sankey diagram visualization). This ensures data consistency and better error handling throughout the system.
- **Enhanced Error Handling and Processing Visibility**: Added comprehensive error reporting with detailed processing step tracking. Users now see exactly which steps succeeded/failed (XML generation, CSV extraction) with specific error messages for troubleshooting.
- **Added generateCSVFromXML Function**: Created new CSV generation function that extracts transaction data directly from XML using regex parsing, replacing the separate PDF-to-CSV analysis to ensure consistent data flow.
- **Improved Frontend Error Display**: Updated banking document tabs and analysis dialogs to show processing step status, error details, and retry options when analysis fails, providing clear visibility into the AI processing workflow.
- **Updated Banking Document Analysis Prompt**: Switched to comprehensive XML-structured analysis with detailed transaction breakdown including transfer identification, categorization, and inflow/outflow tracking according to new specification
- **Enhanced Banking Confirmation UI**: Updated confirmation modal to display XML-structured fields including institution, account_holders, account_type, start_date, and end_date for better alignment with AI analysis output
- **Fixed Date Conversion Errors**: Resolved database insertion issues with timestamp fields by properly converting date strings to ISO format before storage
- **Improved Banking Document Interface**: Modified field labels in confirmation dialog to match XML structure (Financial Institution → Institution, Account Name → Account Type, Period From/To → Start Date/End Date)
- **Increased AI Token Limit**: Enhanced analysis capability by increasing max tokens from 1000 to 8000 for more comprehensive banking document processing

## August 3, 2025 (Earlier Updates)
- **Migrated to Claude Sonnet 4**: Successfully switched PDF processing from OpenAI GPT-4o to Anthropic's Claude Sonnet 4 (claude-sonnet-4-20250514) for enhanced banking document analysis
- **Enhanced Banking Statement Analysis**: Implemented detailed XML-structured transaction analysis with comprehensive categorization, transfer identification, and inflow/outflow tracking
- **Improved Transaction Processing**: Added sophisticated transfer detection (transfer_in/transfer_out), transaction categorization, and detailed CSV generation with expanded columns
- **Relocated Branding to Top Navigation**: Successfully moved "Family Court Documentation" branding and logo from left sidebar to top navigation bar, replacing previous "DocuFlow" branding
- **Fixed Logo Display Issue**: Resolved issue where Family Court logo wasn't appearing on authenticated pages by switching from TopBanner to TopNav component in App.tsx
- **Streamlined Sidebar Layout**: Removed duplicate user information from sidebar since it now appears in top navigation, creating cleaner layout with proper alignment
- **Enhanced Navigation Spacing**: Added proper top padding (pt-16) to main layout containers to accommodate fixed header positioning
- **Updated Mobile Menu Positioning**: Adjusted mobile menu button placement to work with new header layout

## August 2, 2025 (Earlier Updates)
- **Enhanced Banking Document Upload Process**: Implemented dual progress bars showing separate upload and AI processing phases with visual status indicators, animated progress feedback, and colored status dots to clearly communicate each stage of the workflow
- **Always-On PDF Preview**: Modified banking confirmation dialog to always display PDF preview side-by-side with extracted information form, allowing users to visually verify AI-extracted data against the original document for both uploaded files and processed documents
- **Improved Upload UI**: Enhanced progress display with better styling, status animations, and clearer phase indicators during file upload and AI processing stages
- **Fixed Document Status Update UI Issue**: Resolved issue where document status changes weren't reflected in the UI immediately. Added onDocumentUpdate callback to DocumentViewer component to properly update local state when status changes occur, ensuring the UI displays the current status after successful updates.
- **Enhanced Status Update Cache Invalidation**: Improved cache invalidation strategy in StatusSelect component to ensure all related queries are refreshed when document status is updated.
- **Persistent SignOut Button**: Added TopNav component that appears in the top right corner of all authenticated pages, displaying user information and sign out functionality
- **Enhanced CASEADMIN Permissions**: Updated document status system so CASEADMIN users can change document status from any state to any other state, providing full administrative control over document workflow
- **Multi-Role User System**: Implemented comprehensive multi-role assignment capability:
  - Updated database schema to support arrays of roles per user per case
  - Created new MultiRoleSelector component with searchable dropdown and badge display
  - Updated case member management interface to show multiple roles as colored badges
  - Users can now be assigned multiple roles simultaneously (e.g., both REVIEWER and DISCLOSER)
  - Form validation ensures at least one role is selected when adding users or sending invitations

## August 2, 2025 (Earlier Updates)
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