import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileText, Shield, Users, Upload } from "lucide-react";
import logoPath from "@assets/FamilyCourtDoco-Asset_1754059270273.png";

export default function Landing() {
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Header */}
      <header className="legal-header px-6 py-6">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <img 
              src={logoPath} 
              alt="Family Court Doco" 
              className="h-12 w-12 object-contain"
            />
            <div>
              <h1 className="text-2xl font-bold text-white tracking-tight">Family Court Doco</h1>
              <p className="text-sm text-blue-100 mt-1 font-medium">Professional Document Management</p>
            </div>
          </div>
          <Button 
            onClick={() => window.location.href = '/login'}
            className="legal-button-primary px-6 py-2"
          >
            Sign In
          </Button>
        </div>
      </header>

      {/* Hero Section */}
      <main className="flex-1 flex items-center justify-center px-6 py-16">
        <div className="max-w-5xl mx-auto text-center">
          <h2 className="text-5xl font-bold text-slate-900 mb-8 tracking-tight">
            Secure Legal Document Management
          </h2>
          <p className="text-xl text-slate-600 mb-16 max-w-3xl mx-auto leading-relaxed">
            Confidently manage sensitive legal and business documents with enterprise-grade security, 
            structured case organization, and granular role-based access control.
          </p>
          
          {/* Features Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 mb-16">
            <Card className="legal-card p-8">
              <CardHeader className="pb-6">
                <FileText className="h-14 w-14 text-primary mx-auto mb-6" />
                <CardTitle className="text-xl font-semibold text-slate-900 tracking-tight">Case Management</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-slate-600 text-sm leading-relaxed">
                  Create and organize cases with unique identifiers and structured document storage for efficient legal workflows.
                </p>
              </CardContent>
            </Card>

            <Card className="legal-card p-8">
              <CardHeader className="pb-6">
                <Shield className="h-14 w-14 text-primary mx-auto mb-6" />
                <CardTitle className="text-xl font-semibold text-slate-900 tracking-tight">Role-Based Security</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-slate-600 text-sm leading-relaxed">
                  Enterprise-grade access control with DISCLOSER, REVIEWER, DISCLOSEE, and CASEADMIN roles for maximum security.
                </p>
              </CardContent>
            </Card>

            <Card className="legal-card p-8">
              <CardHeader className="pb-6">
                <Upload className="h-14 w-14 text-primary mx-auto mb-6" />
                <CardTitle className="text-xl font-semibold text-slate-900 tracking-tight">Document Upload</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-slate-600 text-sm leading-relaxed">
                  Securely upload PDF documents with organized categorization under Real Property and Banking practice areas.
                </p>
              </CardContent>
            </Card>

            <Card className="legal-card p-8">
              <CardHeader className="pb-6">
                <Users className="h-14 w-14 text-primary mx-auto mb-6" />
                <CardTitle className="text-xl font-semibold text-slate-900 tracking-tight">Case Members</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-slate-600 text-sm leading-relaxed">
                  Manage case members with precise access controls and secure document sharing for confidential matters.
                </p>
              </CardContent>
            </Card>
          </div>

          <div className="flex gap-4 justify-center">
            <Button 
              size="lg"
              onClick={() => window.location.href = '/login'}
              className="legal-button-primary px-10 py-4 text-lg"
            >
              Sign In
            </Button>
            <Button 
              size="lg"
              variant="outline"
              onClick={() => window.location.href = '/auth'}
              className="border-blue-600 text-blue-600 hover:bg-blue-50 px-10 py-4 text-lg"
            >
              Create Account
            </Button>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-slate-800 px-6 py-8">
        <div className="max-w-7xl mx-auto text-center">
          <p className="text-sm text-slate-300 font-medium">
            © 2024 DocuFlow. Secure Legal Document Management Platform.
          </p>
          <p className="text-xs text-slate-400 mt-2">
            Built for legal professionals and enterprise document workflows.
          </p>
        </div>
      </footer>
    </div>
  );
}
