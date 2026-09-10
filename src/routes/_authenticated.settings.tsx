import { createFileRoute } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Link } from "@tanstack/react-router";
import { Building2, FolderKanban, Loader2, LogOut, User, KeyRound, Shield, Sparkles, Landmark, Bell } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import {
  DEFAULT_REMINDER_SETTINGS,
  notificationPermission,
  requestNotificationPermission,
  showNotification,
} from "@/lib/reminders";

export const Route = createFileRoute("/_authenticated/settings")({
  component: SettingsPage,
});

function SettingsPage() {
  const { profile, user, role, signOut } = useAuth();
  const [fullName, setFullName] = useState("");
  const [saving, setSaving] = useState(false);

  // Billing info
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [accountTitle, setAccountTitle] = useState("");
  const [bankName, setBankName] = useState("");
  const [iban, setIban] = useState("");
  const [swift, setSwift] = useState("");
  const [savingBilling, setSavingBilling] = useState(false);

  // Password change state
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  // Reminders
  const [dailyEnabled, setDailyEnabled] = useState(DEFAULT_REMINDER_SETTINGS.daily_enabled);
  const [dailyTime, setDailyTime] = useState(DEFAULT_REMINDER_SETTINGS.daily_time);
  const [monthEndEmail, setMonthEndEmail] = useState(DEFAULT_REMINDER_SETTINGS.month_end_email_enabled);
  const [savingReminders, setSavingReminders] = useState(false);
  const [permission, setPermission] = useState<string>("default");

  useEffect(() => {
    setPermission(notificationPermission());
    if (!user) return;
    supabase
      .from("reminder_settings")
      .select("daily_enabled, daily_time, month_end_email_enabled")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (!data) return;
        setDailyEnabled(data.daily_enabled);
        setDailyTime((data.daily_time || "17:00").slice(0, 5));
        setMonthEndEmail(data.month_end_email_enabled);
      });
  }, [user]);

  const handleToggleDaily = async (next: boolean) => {
    if (next) {
      const result = await requestNotificationPermission();
      setPermission(result);
      if (result === "unsupported") {
        toast.error("Your browser doesn't support notifications");
        return;
      }
      if (result !== "granted") {
        toast.error("Notifications are blocked in your browser settings");
        return;
      }
      showNotification("Reminders are on", "We'll nudge you if you haven't logged time.");
    }
    setDailyEnabled(next);
  };

  const handleSaveReminders = async () => {
    if (!user) return;
    setSavingReminders(true);
    const { error } = await supabase.from("reminder_settings").upsert(
      {
        user_id: user.id,
        daily_enabled: dailyEnabled,
        daily_time: dailyTime,
        month_end_email_enabled: monthEndEmail,
      },
      { onConflict: "user_id" },
    );
    setSavingReminders(false);
    if (error) toast.error("Failed to save reminders");
    else toast.success("Reminder settings saved");
  };


  useEffect(() => {
    if (profile) {
      setFullName(profile.full_name || "");
      setAddress((profile as any).address || "");
      setPhone((profile as any).phone || "");
      setAccountTitle((profile as any).bank_account_title || "");
      setBankName((profile as any).bank_name || "");
      setIban((profile as any).iban || "");
      setSwift((profile as any).swift_code || "");
    }
  }, [profile]);

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({
        full_name: fullName,
      })
      .eq("user_id", user.id);

    setSaving(false);
    if (error) {
      toast.error("Failed to save settings");
    } else {
      toast.success("Settings saved");
    }
  };

  const handleSaveBilling = async () => {
    if (!user) return;
    setSavingBilling(true);
    const { error } = await supabase
      .from("profiles")
      .update({
        address,
        phone,
        bank_account_title: accountTitle,
        bank_name: bankName,
        iban,
        swift_code: swift,
      } as any)
      .eq("user_id", user.id);
    setSavingBilling(false);
    if (error) toast.error("Failed to save billing info");
    else toast.success("Billing info saved");
  };

  const handleChangePassword = async () => {
    if (!user?.email) return;
    if (newPassword.length < 8) {
      toast.error("New password must be at least 8 characters");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("New passwords do not match");
      return;
    }
    if (newPassword === currentPassword) {
      toast.error("New password must be different from current password");
      return;
    }
    setChangingPassword(true);
    // Re-authenticate with current password
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: user.email,
      password: currentPassword,
    });
    if (signInError) {
      setChangingPassword(false);
      toast.error("Current password is incorrect");
      return;
    }
    const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });
    setChangingPassword(false);
    if (updateError) {
      toast.error(updateError.message || "Failed to update password");
      return;
    }
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    toast.success("Password updated");
  };

  const handleSignOut = async () => {
    setSigningOut(true);
    await signOut();
    setSigningOut(false);
  };

  return (
    <div className="space-y-8 max-w-3xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground text-sm mt-1">Manage your profile and account</p>
      </div>

      <div className="space-y-6">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2"><User className="h-4 w-4 text-muted-foreground" />Profile</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input id="email" value={profile?.email || ""} disabled className="bg-muted/50" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="fullName">Full name</Label>
            <Input id="fullName" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Your name" />
          </div>
          <Button onClick={handleSave} disabled={saving} className="rounded-xl">
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {saving ? "Saving…" : "Save changes"}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2"><Bell className="h-4 w-4 text-muted-foreground" />Reminders</CardTitle>
          <p className="text-xs text-muted-foreground pt-1">Gentle nudges so you don't forget to log your time</p>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-0.5">
              <Label htmlFor="dailyEnabled">Daily reminder</Label>
              <p className="text-xs text-muted-foreground">
                A browser notification if you haven't logged time that day (only while the app is open).
              </p>
              {permission === "denied" && (
                <p className="text-xs text-destructive">
                  Notifications are blocked in your browser — allow them for this site to use this.
                </p>
              )}
            </div>
            <Switch id="dailyEnabled" checked={dailyEnabled} onCheckedChange={handleToggleDaily} />
          </div>

          {dailyEnabled && (
            <div className="space-y-1.5 max-w-[180px]">
              <Label htmlFor="dailyTime">Remind me at</Label>
              <Input id="dailyTime" type="time" value={dailyTime} onChange={(e) => setDailyTime(e.target.value)} />
            </div>
          )}

          <div className="flex items-start justify-between gap-4">
            <div className="space-y-0.5">
              <Label htmlFor="monthEndEmail">Month-end email reminders</Label>
              <p className="text-xs text-muted-foreground">
                An email on each of the last 5 days of the month if you have days with no time logged.
              </p>
            </div>
            <Switch id="monthEndEmail" checked={monthEndEmail} onCheckedChange={setMonthEndEmail} />
          </div>

          <Button onClick={handleSaveReminders} disabled={savingReminders} className="rounded-xl">
            {savingReminders && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {savingReminders ? "Saving…" : "Save reminders"}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">

          <CardTitle className="text-base flex items-center gap-2"><Landmark className="h-4 w-4 text-muted-foreground" />Billing info</CardTitle>
          <p className="text-xs text-muted-foreground pt-1">Used on invoices generated for you</p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1.5 md:col-span-2">
              <Label htmlFor="address">Address</Label>
              <Input id="address" value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Street, city, country" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="phone">Phone</Label>
              <Input id="phone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+1 555 555 5555" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="accountTitle">Account title</Label>
              <Input id="accountTitle" value={accountTitle} onChange={(e) => setAccountTitle(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="bankName">Bank</Label>
              <Input id="bankName" value={bankName} onChange={(e) => setBankName(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="iban">IBAN / Account number</Label>
              <Input id="iban" value={iban} onChange={(e) => setIban(e.target.value)} />
            </div>
            <div className="space-y-1.5 md:col-span-2">
              <Label htmlFor="swift">SWIFT code</Label>
              <Input id="swift" value={swift} onChange={(e) => setSwift(e.target.value)} />
            </div>
          </div>
          <Button onClick={handleSaveBilling} disabled={savingBilling} className="rounded-xl">
            {savingBilling && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {savingBilling ? "Saving…" : "Save billing info"}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2"><KeyRound className="h-4 w-4 text-muted-foreground" />Change password</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="currentPassword">Current password</Label>
            <Input
              id="currentPassword"
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              autoComplete="current-password"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="newPassword">New password</Label>
            <Input
              id="newPassword"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              autoComplete="new-password"
              placeholder="At least 8 characters"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="confirmPassword">Confirm new password</Label>
            <Input
              id="confirmPassword"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              autoComplete="new-password"
            />
          </div>
          <div className="flex items-center gap-3">
            <Button
              onClick={handleChangePassword}
              disabled={changingPassword || !currentPassword || !newPassword || !confirmPassword}
              className="rounded-xl"
            >
              {changingPassword && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {changingPassword ? "Updating…" : "Update password"}
            </Button>
            <Link to="/forgot-password" className="text-xs text-muted-foreground hover:text-foreground hover:underline">
              Forgot current password?
            </Link>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2"><Shield className="h-4 w-4 text-muted-foreground" />Account</CardTitle>
        </CardHeader>
        <CardContent>
          <Button variant="outline" onClick={handleSignOut} disabled={signingOut} className="rounded-xl">
            {signingOut ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <LogOut className="h-4 w-4 mr-2" />
            )}
            {signingOut ? "Signing out…" : "Sign out"}
          </Button>
        </CardContent>
      </Card>

      {role === "admin" && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2"><Sparkles className="h-4 w-4 text-muted-foreground" />Admin quick links</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" asChild className="rounded-xl">
              <Link to="/admin/clients"><Building2 className="h-3.5 w-3.5 mr-1.5" />Manage Clients</Link>
            </Button>
            <Button variant="outline" size="sm" asChild className="rounded-xl">
              <Link to="/admin/projects"><FolderKanban className="h-3.5 w-3.5 mr-1.5" />Manage Projects</Link>
            </Button>
          </CardContent>
        </Card>
      )}
      </div>
    </div>
  );
}
