import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

interface StatusBadgeProps {
  status: string;
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const statusConfig = {
    UPLOADED: {
      label: "Uploaded",
      className: "status-uploaded"
    },
    READYFORREVIEW: {
      label: "Ready for Review",
      className: "status-readyforreview"
    },
    REVIEWED: {
      label: "Reviewed",
      className: "status-reviewed"
    },
    WITHDRAWN: {
      label: "Withdrawn",
      className: "status-withdrawn"
    }
  };

  const config = statusConfig[status as keyof typeof statusConfig] || {
    label: status,
    className: "bg-gray-50 text-gray-600 border border-gray-200"
  };

  return (
    <Badge 
      variant="outline" 
      className={cn(config.className, className)}
    >
      {config.label}
    </Badge>
  );
}