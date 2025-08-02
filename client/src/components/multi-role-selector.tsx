import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

type Role = "CASEADMIN" | "DISCLOSER" | "DISCLOSEE" | "REVIEWER";

const roleLabels: Record<Role, string> = {
  CASEADMIN: "Case Admin",
  DISCLOSER: "Discloser", 
  DISCLOSEE: "Disclosee",
  REVIEWER: "Reviewer",
};

const roleColors: Record<Role, string> = {
  CASEADMIN: "bg-red-100 text-red-800",
  DISCLOSER: "bg-blue-100 text-blue-800",
  DISCLOSEE: "bg-green-100 text-green-800",
  REVIEWER: "bg-yellow-100 text-yellow-800",
};

interface MultiRoleSelectorProps {
  selectedRoles: Role[];
  onRolesChange: (roles: Role[]) => void;
  placeholder?: string;
  disabled?: boolean;
}

export function MultiRoleSelector({
  selectedRoles,
  onRolesChange,
  placeholder = "Select roles...",
  disabled = false
}: MultiRoleSelectorProps) {
  const allRoles: Role[] = ["CASEADMIN", "DISCLOSER", "DISCLOSEE", "REVIEWER"];

  const handleToggleRole = (role: Role, checked: boolean) => {
    if (checked) {
      onRolesChange([...selectedRoles, role]);
    } else {
      onRolesChange(selectedRoles.filter(r => r !== role));
    }
  };

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        {allRoles.map((role) => (
          <div key={role} className="flex items-center space-x-3">
            <Checkbox
              id={`role-${role}`}
              checked={selectedRoles.includes(role)}
              onCheckedChange={(checked) => handleToggleRole(role, checked as boolean)}
              disabled={disabled}
            />
            <Label 
              htmlFor={`role-${role}`} 
              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
            >
              {roleLabels[role]}
            </Label>
            {selectedRoles.includes(role) && (
              <Badge className={`${roleColors[role]} ml-2`}>
                {roleLabels[role]}
              </Badge>
            )}
          </div>
        ))}
      </div>
      
      {selectedRoles.length === 0 && (
        <p className="text-sm text-slate-500 italic">{placeholder}</p>
      )}
    </div>
  );
}