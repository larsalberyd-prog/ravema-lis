import { createContext, useContext, useState, useEffect, ReactNode } from "react";

type Role = "fc" | "sdr" | "salesperson";

interface RoleContextType {
  role: Role;
  setRole: (role: Role) => void;
  salespersonName: string | null;
  setSalespersonName: (name: string) => void;
}

const RoleContext = createContext<RoleContextType | undefined>(undefined);

export function RoleProvider({ children }: { children: ReactNode }) {
  const [role, setRoleState] = useState<Role>("fc");
  const [salespersonName, setSalespersonNameState] = useState<string | null>(null);

  useEffect(() => {
    const storedRole = localStorage.getItem("ravema-lis-role") as Role | null;
    const storedName = localStorage.getItem("ravema-lis-salesperson-name");
    
    if (storedRole) {
      setRoleState(storedRole);
    }
    if (storedName) {
      setSalespersonNameState(storedName);
    }
  }, []);

  const setRole = (newRole: Role) => {
    setRoleState(newRole);
    localStorage.setItem("ravema-lis-role", newRole);
  };

  const setSalespersonName = (name: string) => {
    setSalespersonNameState(name);
    localStorage.setItem("ravema-lis-salesperson-name", name);
  };

  return (
    <RoleContext.Provider value={{ role, setRole, salespersonName, setSalespersonName }}>
      {children}
    </RoleContext.Provider>
  );
}

export function useRole() {
  const context = useContext(RoleContext);
  if (!context) {
    throw new Error("useRole must be used within RoleProvider");
  }
  return context;
}
