import { useState } from "react";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface DeleteEntryButtonProps {
  entryId: string;
  onDeleted?: () => void;
  size?: "sm" | "icon";
  className?: string;
}

export function DeleteEntryButton({ entryId, onDeleted, size = "icon", className }: DeleteEntryButtonProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleDelete = async () => {
    setLoading(true);
    const { error } = await supabase.from("time_entries").delete().eq("id", entryId);
    setLoading(false);
    if (error) {
      toast.error(error.message || "Failed to delete entry");
      return;
    }
    toast.success("Entry deleted");
    setOpen(false);
    onDeleted?.();
  };

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button
          size={size === "icon" ? "icon" : "sm"}
          variant="ghost"
          className={cn(
            size === "icon" ? "h-7 w-7" : "text-xs",
            "text-muted-foreground hover:text-destructive",
            className,
          )}
          title="Delete entry"
        >
          <Trash2 className={size === "icon" ? "h-3 w-3" : "h-3 w-3 mr-1"} />
          {size !== "icon" && "Delete"}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete this time entry?</AlertDialogTitle>
          <AlertDialogDescription>
            This action cannot be undone. The entry will be permanently removed.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={loading}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault();
              handleDelete();
            }}
            disabled={loading}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {loading ? "Deleting..." : "Delete"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}