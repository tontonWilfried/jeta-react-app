import React, { createContext, useContext, useState } from 'react';

const DiscussionSelectionContext = createContext();

export function DiscussionSelectionProvider({ children }) {
  const [selectedDiscussionUid, setSelectedDiscussionUid] = useState(null);
  return (
    <DiscussionSelectionContext.Provider value={{ selectedDiscussionUid, setSelectedDiscussionUid }}>
      {children}
    </DiscussionSelectionContext.Provider>
  );
}

export function useDiscussionSelection() {
  return useContext(DiscussionSelectionContext);
} 