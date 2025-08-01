import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileText, Shield, Users, Upload } from "lucide-react";

export default function Landing() {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">DocuFlow</h1>
            <p className="text-sm text-gray-600 mt-1">Document Management System</p>
          </div>
          <Button 
            onClick={() => window.location.href = '/api/login'}
            className="bg-primary hover:bg-blue-700"
          >
            Sign In
          </Button>
        </div>
      </header>

      {/* Hero Section */}
      <main className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-4xl font-bold text-gray-900 mb-6">
            Professional Document Management
          </h2>
          <p className="text-xl text-gray-600 mb-12 max-w-2xl mx-auto">
            Securely manage legal and business documents with role-based access control, 
            organized case management, and streamlined document workflows.
          </p>
          
          {/* Features Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
            <Card className="p-6">
              <CardHeader className="pb-4">
                <FileText className="h-12 w-12 text-primary mx-auto mb-4" />
                <CardTitle className="text-lg">Case Management</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600 text-sm">
                  Create and organize cases with unique identifiers and structured document storage.
                </p>
              </CardContent>
            </Card>

            <Card className="p-6">
              <CardHeader className="pb-4">
                <Shield className="h-12 w-12 text-primary mx-auto mb-4" />
                <CardTitle className="text-lg">Role-Based Access</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600 text-sm">
                  Secure access control with DISCLOSER, REVIEWER, DISCLOSEE, and CASEADMIN roles.
                </p>
              </CardContent>
            </Card>

            <Card className="p-6">
              <CardHeader className="pb-4">
                <Upload className="h-12 w-12 text-primary mx-auto mb-4" />
                <CardTitle className="text-lg">Document Upload</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600 text-sm">
                  Upload PDF documents with organized categorization under Real Property and Banking.
                </p>
              </CardContent>
            </Card>

            <Card className="p-6">
              <CardHeader className="pb-4">
                <Users className="h-12 w-12 text-primary mx-auto mb-4" />
                <CardTitle className="text-lg">Team Collaboration</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600 text-sm">
                  Collaborate with team members with appropriate access levels and document sharing.
                </p>
              </CardContent>
            </Card>
          </div>

          <Button 
            size="lg"
            onClick={() => window.location.href = '/api/login'}
            className="bg-primary hover:bg-blue-700 px-8 py-3 text-lg"
          >
            Get Started
          </Button>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-200 px-6 py-4">
        <div className="max-w-7xl mx-auto text-center text-sm text-gray-600">
          © 2024 DocuFlow. Professional Document Management System.
        </div>
      </footer>
    </div>
  );
}
