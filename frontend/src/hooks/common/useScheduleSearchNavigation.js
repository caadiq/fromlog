import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

// Keep search screens in router history so detail navigation and reloads preserve them.
export function useScheduleSearchNavigation() {
  const location = useLocation();
  const navigate = useNavigate();
  const params = new URLSearchParams(location.search);
  const isSearchMode = params.has('search');
  const searchTerm = params.get('search') || '';
  const [searchInput, setSearchInput] = useState(searchTerm);
  useEffect(() => setSearchInput(searchTerm), [searchTerm, isSearchMode]);

  const setIsSearchMode = (open) => {
    const next = new URLSearchParams(location.search);
    if (open) next.set('search', '');
    else next.delete('search');
    navigate({ pathname: location.pathname, search: next.toString() }, { state: { searchOpenedHere: open } });
  };
  const setSearchTerm = (value) => {
    if (value.trim() === searchTerm) return;
    if (!value.trim() && searchTerm && location.state?.searchResultsEntry) {
      navigate(-1);
      return;
    }
    const next = new URLSearchParams(location.search);
    next.set('search', value.trim());
    navigate({ pathname: location.pathname, search: next.toString() }, {
      replace: !!searchTerm,
      state: { ...location.state, searchResultsEntry: !!value.trim() && (!searchTerm || !!location.state?.searchResultsEntry) },
    });
  };
  const backFromSearch = () => {
    if (searchTerm) {
      if (location.state?.searchResultsEntry) navigate(-1);
      else setSearchTerm('');
    } else if (location.state?.searchOpenedHere) {
      navigate(-1);
    } else {
      const next = new URLSearchParams(location.search);
      next.delete('search');
      navigate({ pathname: location.pathname, search: next.toString() }, { replace: true });
    }
  };
  return { isSearchMode, searchTerm, searchInput, setSearchInput, setSearchTerm, setIsSearchMode, backFromSearch };
}
