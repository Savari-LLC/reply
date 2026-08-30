import { createContext, useContext, useMemo, useState, type ReactNode } from "react";

export type SelectedInbox = {
  id: string;
  name: string;
  kind: "personal" | "shared";
};

type InboxSelectionValue = {
  selected: SelectedInbox | null;
  select: (inbox: SelectedInbox) => void;
};

const InboxSelectionContext = createContext<InboxSelectionValue | undefined>(
  undefined,
);

/**
 * Which mailbox the main screen is showing. The app lands on the personal
 * inbox and the sidebar sheet switches this selection in place.
 */
export function InboxSelectionProvider({ children }: { children: ReactNode }) {
  const [selected, setSelected] = useState<SelectedInbox | null>(null);
  const value = useMemo(
    () => ({ selected, select: setSelected }),
    [selected],
  );
  return (
    <InboxSelectionContext.Provider value={value}>
      {children}
    </InboxSelectionContext.Provider>
  );
}

export function useInboxSelection(): InboxSelectionValue {
  const value = useContext(InboxSelectionContext);
  if (value === undefined) {
    throw new Error("useInboxSelection must be used within InboxSelectionProvider");
  }
  return value;
}
