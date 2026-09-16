/**
 * ============================================================================
 * PRISM — Custom State Combobox / Dropdown Component (v11)
 * Accessible, keyboard-navigable, searchable floating state selector.
 * ============================================================================
 */

import { renderIcons, escapeHtml } from './utils.js';

let allStates = [];
let selectedValue = null;
let onSelectCallback = null;
let isOpen = false;
let currentHighlightedIndex = -1;

export function initStateDropdown({ onSelect }) {
  onSelectCallback = onSelect;

  const btn = document.getElementById('user-state-btn');
  const dropdown = document.getElementById('user-state-dropdown');
  const searchInput = document.getElementById('user-state-search');
  const clearBtn = document.getElementById('btn-user-state-clear');
  const container = document.getElementById('user-state-container');

  btn?.addEventListener('click', (e) => {
    e.stopPropagation();
    toggleDropdown();
  });

  clearBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    selectState(null);
  });

  // Search filter
  searchInput?.addEventListener('input', (e) => {
    filterOptions(e.target.value);
  });

  // Keyboard navigation within search input
  searchInput?.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      highlightNextOption(1);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      selectFirstVisibleOption();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      closeDropdown();
      btn?.focus();
    }
  });

  // Keyboard navigation on trigger button
  btn?.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      if (!isOpen) {
        openDropdown();
      } else {
        highlightNextOption(1);
      }
    } else if (e.key === 'Escape') {
      if (isOpen) {
        e.preventDefault();
        closeDropdown();
      }
    }
  });

  // Close on click outside
  document.addEventListener('click', (e) => {
    if (isOpen && container && !container.contains(e.target)) {
      closeDropdown();
    }
  });

  // Global escape key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && isOpen) {
      closeDropdown();
      btn?.focus();
    }
  });
}

export function populateStateDropdown(states = [], currentVal = null) {
  allStates = states || [];
  selectedValue = currentVal;
  renderOptionItems(allStates);
  updateTriggerDisplay();
}

export function setStateDropdownValue(val) {
  selectedValue = val || null;
  updateTriggerDisplay();
  updateSelectedOptionHighlight();
}

export function openDropdown() {
  const dropdown = document.getElementById('user-state-dropdown');
  const btn = document.getElementById('user-state-btn');
  const chevron = document.getElementById('user-state-chevron');
  const searchInput = document.getElementById('user-state-search');

  if (!dropdown) return;
  dropdown.classList.remove('hidden');
  isOpen = true;
  btn?.setAttribute('aria-expanded', 'true');
  chevron?.classList.add('rotate-180');

  // Reset search and render full list
  if (searchInput) {
    searchInput.value = '';
    filterOptions('');
    setTimeout(() => searchInput.focus(), 50);
  }
}

export function closeDropdown() {
  const dropdown = document.getElementById('user-state-dropdown');
  const btn = document.getElementById('user-state-btn');
  const chevron = document.getElementById('user-state-chevron');

  if (!dropdown) return;
  dropdown.classList.add('hidden');
  isOpen = false;
  btn?.setAttribute('aria-expanded', 'false');
  chevron?.classList.remove('rotate-180');
  currentHighlightedIndex = -1;
}

function toggleDropdown() {
  if (isOpen) {
    closeDropdown();
  } else {
    openDropdown();
  }
}

function updateTriggerDisplay() {
  const label = document.getElementById('user-state-selected-label');
  const hiddenInput = document.getElementById('user-state-select');
  if (label) {
    label.textContent = selectedValue || '-- Select State --';
    if (selectedValue) {
      label.classList.add('font-semibold', 'text-blue-900');
    } else {
      label.classList.remove('font-semibold', 'text-blue-900');
    }
  }
  if (hiddenInput) {
    hiddenInput.value = selectedValue || '';
  }
}

function renderOptionItems(filteredList) {
  const listEl = document.getElementById('user-state-options');
  const countLabel = document.getElementById('user-state-count-label');
  if (!listEl) return;

  if (countLabel) {
    countLabel.textContent = `${filteredList.length} of ${allStates.length} States/UTs`;
  }

  if (filteredList.length === 0) {
    listEl.innerHTML = `
      <li class="px-3 py-4 text-center text-slate-400 text-xs">
        <i data-lucide="search-x" class="w-4 h-4 mx-auto mb-1 opacity-50"></i>
        No matching states found
      </li>
    `;
    renderIcons();
    return;
  }

  listEl.innerHTML = filteredList.map((st, idx) => {
    const isSelected = st === selectedValue;
    return `
      <li role="option"
          tabindex="0"
          data-value="${escapeHtml(st)}"
          data-index="${idx}"
          aria-selected="${isSelected}"
          class="user-state-option px-3 py-1.5 flex items-center justify-between cursor-pointer text-xs transition-colors select-none ${
            isSelected
              ? 'bg-blue-50/90 text-blue-800 font-bold'
              : 'text-slate-700 hover:bg-slate-100/80 focus:bg-slate-100'
          }">
        <span class="truncate">${escapeHtml(st)}</span>
        ${isSelected ? '<i data-lucide="check" class="w-3.5 h-3.5 text-blue-600 shrink-0"></i>' : ''}
      </li>
    `;
  }).join('');

  renderIcons();

  // Attach event listeners to options
  listEl.querySelectorAll('.user-state-option').forEach((item) => {
    item.addEventListener('click', (e) => {
      e.stopPropagation();
      const val = item.getAttribute('data-value');
      selectState(val);
    });

    item.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        const val = item.getAttribute('data-value');
        selectState(val);
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        highlightNextOption(1);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        highlightNextOption(-1);
      } else if (e.key === 'Escape') {
        e.preventDefault();
        closeDropdown();
        document.getElementById('user-state-btn')?.focus();
      }
    });
  });
}

function filterOptions(query = '') {
  const q = query.trim().toLowerCase();
  const filtered = q
    ? allStates.filter((s) => s.toLowerCase().includes(q))
    : allStates;
  renderOptionItems(filtered);
  currentHighlightedIndex = -1;
}

function selectState(val) {
  selectedValue = val || null;
  updateTriggerDisplay();
  closeDropdown();
  document.getElementById('user-state-btn')?.focus();

  if (onSelectCallback) {
    onSelectCallback(selectedValue);
  }
}

function selectFirstVisibleOption() {
  const firstOption = document.querySelector('#user-state-options .user-state-option');
  if (firstOption) {
    const val = firstOption.getAttribute('data-value');
    selectState(val);
  }
}

function highlightNextOption(direction) {
  const options = Array.from(document.querySelectorAll('#user-state-options .user-state-option'));
  if (!options.length) return;

  currentHighlightedIndex += direction;

  if (currentHighlightedIndex < 0) {
    // Return to search input
    currentHighlightedIndex = -1;
    document.getElementById('user-state-search')?.focus();
    return;
  }

  if (currentHighlightedIndex >= options.length) {
    currentHighlightedIndex = options.length - 1;
  }

  const target = options[currentHighlightedIndex];
  if (target) {
    target.focus();
    target.scrollIntoView({ block: 'nearest' });
  }
}

function updateSelectedOptionHighlight() {
  const options = document.querySelectorAll('#user-state-options .user-state-option');
  options.forEach((opt) => {
    const isSelected = opt.getAttribute('data-value') === selectedValue;
    opt.setAttribute('aria-selected', isSelected ? 'true' : 'false');
    if (isSelected) {
      opt.classList.add('bg-blue-50/90', 'text-blue-800', 'font-bold');
      opt.classList.remove('text-slate-700', 'hover:bg-slate-100/80');
    } else {
      opt.classList.remove('bg-blue-50/90', 'text-blue-800', 'font-bold');
      opt.classList.add('text-slate-700', 'hover:bg-slate-100/80');
    }
  });
}
