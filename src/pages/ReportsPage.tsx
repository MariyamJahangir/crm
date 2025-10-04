import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
    useReactTable, getCoreRowModel, getSortedRowModel, flexRender,
    SortingState, ColumnFiltersState, Header, ColumnDef
} from '@tanstack/react-table';
import { ArrowDownNarrowWide, SortAsc, SortDesc, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Calendar } from 'lucide-react';
import { reportsService, ReportParams, LeadReportRow } from '../services/reportsService';
import { useAuth } from '../contexts/AuthContext';
import { format, parseISO, isAfter, isBefore } from 'date-fns';
import debounce from 'lodash.debounce';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';


const styles: { [key: string]: React.CSSProperties } = {
    pageContainer: { padding: '1.5rem', minHeight: '100vh' },
    header: { fontSize: '1.875rem', fontWeight: 'bold', color: '#111827' },
    filtersContainer: { margin: '1.5rem 0', padding: '1rem', backgroundColor: 'white', borderRadius: '0.5rem', boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)', display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '1rem', zIndex: 20 },
    filterGroup: { display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', position: 'relative' },
    dateInput: { padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: '0.375rem' },
    filterButton: { backgroundColor: 'white', color: '#374151', border: '1px solid #d1d5db', padding: '0.5rem 1rem', borderRadius: '0.375rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem' },
    tableContainer: { overflowX: 'auto', backgroundColor: 'white', borderRadius: '0.5rem', boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)' },
    table: { width: '100%', borderCollapse: 'collapse' },
    th: { padding: '0.75rem 1rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: 600, color: '#4b5563', textTransform: 'uppercase', backgroundColor: '#f3f4f6', whiteSpace: 'nowrap' },
    td: { padding: '0.75rem 1rem', whiteSpace: 'nowrap', fontSize: '0.875rem', color: '#374151', borderTop: '1px solid #e5e7eb' },
    loadingOrError: { textAlign: 'center', padding: '2rem', color: '#6b7280' },
    paginationContainer: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1rem', backgroundColor: 'white', borderTop: '1px solid #e5e7eb', flexWrap: 'wrap', gap: '1rem' },
    filterableHeader: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'relative', gap: '8px' },
    headerContent: { cursor: 'pointer', userSelect: 'none', display: 'flex', alignItems: 'center', gap: '4px' },
    filterDropdown: { position: 'absolute', top: '100%', right: 0, zIndex: 9999, marginTop: '0.5rem', backgroundColor: 'white', border: '1px solid #d1d5db', borderRadius: '0.375rem', boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)', padding: '0.5rem', minWidth: '240px' },
    optionsList: { maxHeight: '250px', overflowY: 'auto'},
    optionLabel: { display: 'flex', alignItems: 'center', padding: '0.5rem', cursor: 'pointer', borderRadius: '0.25rem', fontSize: '0.875rem', userSelect: 'none' },
    dateGreen: { color: '#10B981', fontWeight: 'bold' },
    dateRed: { color: '#EF4444', fontWeight: 'bold' },
    dateDropdownItem: { padding: '0.5rem 1rem', cursor: 'pointer', borderRadius: '0.25rem', width: '100%', textAlign: 'left' },
};


// --- FILTERABLE HEADER COMPONENT ---
const FilterableHeader = <TData,>({ header, options }: { header: Header<TData, unknown>, options: any[] }) => {
    const [showFilter, setShowFilter] = useState(false);
    const filterRef = useRef<HTMLDivElement>(null);
    const { column } = header;


    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (filterRef.current && !filterRef.current.contains(event.target as Node)) setShowFilter(false);
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);


    const handleCheckboxChange = (value: string) => {
        const currentFilter = (column.getFilterValue() as string[]) || [];
        const newFilter = currentFilter.includes(value) ? currentFilter.filter(v => v !== value) : [...currentFilter, value];
        column.setFilterValue(newFilter.length > 0 ? newFilter : undefined);
    };


    const SortIcon = { asc: SortAsc, desc: SortDesc }[column.getIsSorted() as string] ?? null;


    const formatCurrency = (value: number) => {
        return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', notation: 'compact' }).format(value);
    };


    return (
        <div style={styles.filterableHeader}>
            <div style={styles.headerContent} onClick={column.getToggleSortingHandler()}>
                {flexRender(column.columnDef.header, header.getContext())}
                {SortIcon && <SortIcon size={16} />}
            </div>
            <button onClick={(e) => { e.stopPropagation(); setShowFilter(s => !s); }} aria-label="Filter column"><ArrowDownNarrowWide size={16} /></button>
            {showFilter && (
                <div ref={filterRef} style={{ ...styles.filterDropdown, right: 'auto', left: 0 }}>
                    <div style={styles.optionsList}>
                        {(options || []).map((option, index) => {
                            const isObject = typeof option === 'object' && option !== null && 'name' in option;
                            const value = isObject ? option.name : option;
                            const displayLabel = isObject
                                ? `${option.name} (${formatCurrency(option.valuation)})`
                                : option;
                            
                            return (
                                <label key={`${value}-${index}`} style={styles.optionLabel}>
                                    <input
                                        type="checkbox"
                                        checked={((column.getFilterValue() as string[]) || []).includes(value)}
                                        onChange={() => handleCheckboxChange(value)}
                                        style={{ marginRight: '0.5rem' }}
                                    />
                                    {displayLabel}
                                </label>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
};


// --- MAIN REPORTS PAGE COMPONENT ---
interface FilterOptions {
    salesmen: string[];
    leadNames: string[];
    stages: { name: string; valuation: number }[];
    forecasts: { name: string; valuation: number }[];
    quoteValueRanges: string[];
    gpPercentageRanges: string[];
}
const ReportsPage: React.FC = () => {
    const { token } = useAuth();
    const navigate = useNavigate();
    const [reportData, setReportData] = useState<LeadReportRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [filterOptions, setFilterOptions] = useState<FilterOptions | null>(null);


    const [dateFilter, setDateFilter] = useState('all_time');
    const [customStartDate, setCustomStartDate] = useState('');
    const [customEndDate, setCustomEndDate] = useState('');
    const [showDateDropdown, setShowDateDropdown] = useState(false);
    const dateFilterRef = useRef<HTMLDivElement>(null);


    const [sorting, setSorting] = useState<SortingState>([{ id: 'createdAt', desc: true }]);
    const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
    const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 20 });
    const [totalRows, setTotalRows] = useState(0);


    useEffect(() => {
        if (!token) return;
        reportsService.getFilterOptions(token)
            .then(res => { if (res.success) setFilterOptions(res as any); })
            .catch(err => console.error("Failed to fetch filter options", err));
    }, [token]);


    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dateFilterRef.current && !dateFilterRef.current.contains(event.target as Node)) setShowDateDropdown(false);
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);


    useEffect(() => {
        if (!token) return;
        const fetchReport = async () => {
            setLoading(true);
            setError(null);


            const params: ReportParams = {
                dateFilter,
                customStartDate: dateFilter === 'custom' ? customStartDate : undefined,
                customEndDate: dateFilter === 'custom' ? customEndDate : undefined,
                sortBy: sorting[0]?.id,
                sortOrder: sorting[0]?.desc ? 'DESC' : 'ASC',
                filters: columnFilters.map(f => ({ field: f.id, include: f.value as any[] })),
                page: pagination.pageIndex + 1,
                pageSize: pagination.pageSize,
            };


            try {
                if (dateFilter === 'custom' && (!customStartDate || !customEndDate)) {
                    setReportData([]); setTotalRows(0); setLoading(false); return;
                }
                const res = await reportsService.getLeadReport(params, token);
                if (res.success) {
                    setReportData(res.results as LeadReportRow[]);
                    setTotalRows(res.totalRows || 0);
                } else { setError(res.message || 'An error occurred.'); }
            } catch (err) { setError('Failed to connect to the server.'); }
            finally { setLoading(false); }
        };


        const debouncedFetch = debounce(fetchReport, 500);
        debouncedFetch();
        return () => debouncedFetch.cancel();
    }, [token, sorting, columnFilters, pagination, dateFilter, customStartDate, customEndDate]);


    const columns = useMemo<ColumnDef<LeadReportRow>[]>(() => [
        { accessorKey: 'companyName', header: 'Lead Name', enableColumnFilter: true },
        { 
            accessorKey: 'uniqueNumber', 
            header: 'Lead ID', 
            enableColumnFilter: false,
            cell: ({ row }) => (
                <button 
                    onClick={() => navigate(`/leads/${row.original.id}`)}
                    style={{ color: '#2563eb', textDecoration: 'underline', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                >
                    {row.original.uniqueNumber}
                </button>
            )
        },
        { 
            accessorKey: 'quoteNumber', 
            header: 'Quote Number', 
            enableColumnFilter: false,
            cell: ({ row }) => {
                const quoteNumber = row.original.quoteNumber;
                const previewUrl = (row.original as any).previewUrl;


                if (previewUrl) {
                    return (
                        <a href={previewUrl} target="_blank" rel="noopener noreferrer" style={{ color: '#2563eb', textDecoration: 'underline' }}>
                            {quoteNumber}
                        </a>
                    );
                }
                return quoteNumber || '-';
            }
        },
        { accessorKey: 'salesmanName', header: 'Salesman', enableColumnFilter: true },
        { accessorKey: 'stage', header: 'Stage', enableColumnFilter: true },
        { accessorKey: 'forecastCategory', header: 'Forecast', enableColumnFilter: true },
        {
            accessorKey: 'closingDate', header: 'Closing Date',
            enableColumnFilter: false,
            cell: ({ row }) => {
                const dates = row.original.closingDates;
                if (!dates || !Array.isArray(dates) || dates.length === 0) return '-';


                const latestDate = parseISO(dates[dates.length - 1]);
                let dateStyle = {};
                let tooltip = `Current: ${format(latestDate, 'MMM d, yyyy')}`;


                if (dates.length > 1) {
                    const prevDate = parseISO(dates[dates.length - 2]);
                    if (isAfter(latestDate, prevDate)) {
                        dateStyle = styles.dateRed; // Delayed
                        tooltip = `Delayed: ${format(prevDate, 'd MMM')} → ${format(latestDate, 'd MMM yyyy')}`;
                    } else if (isBefore(latestDate, prevDate)) {
                        dateStyle = styles.dateGreen; // Advanced
                        tooltip = `Advanced: ${format(prevDate, 'd MMM')} ← ${format(latestDate, 'd MMM yyyy')}`;
                    }
                }
                return <span style={dateStyle} title={tooltip}>{format(latestDate, 'MMM d, yyyy')}</span>;
            }
        },
        { 
            accessorKey: 'quoteValue', 
            header: 'Quote Value', 
            enableColumnFilter: false, 
            cell: info => {
                const currency = (info.row.original as any).currencySymbol || '$';
                return `${currency} ${Number(info.getValue<number>() || 0).toLocaleString()}`;
            }
        },
        { 
            accessorKey: 'gpAmount', 
            header: 'GP Amount', 
            enableColumnFilter: false, 
            cell: info => {
                const currency = (info.row.original as any).currencySymbol || '$';
                return `${currency} ${Number(info.getValue<number>() || 0).toLocaleString()}`;
            }
        },
        { accessorKey: 'gpPercentage', header: 'GP %', enableColumnFilter: true, cell: info => `${Number(info.getValue<number>() || 0).toFixed(2)}%`},
        { accessorKey: 'createdAt', header: 'Created Date', enableColumnFilter: false, cell: info => format(parseISO(info.getValue<string>()), 'MMM d, yyyy')},
    ], [navigate]);


    const table = useReactTable({
        data: reportData,
        columns,
        state: { sorting, columnFilters, pagination },
        onSortingChange: setSorting,
        onColumnFiltersChange: setColumnFilters,
        onPaginationChange: setPagination,
        getCoreRowModel: getCoreRowModel(),
        getSortedRowModel: getSortedRowModel(),
        manualSorting: true,
        manualFiltering: true,
        manualPagination: true,
        pageCount: Math.ceil(totalRows / pagination.pageSize) || -1,
    });


    // **FIX START: Corrected key for gpPercentage and wrapped in useMemo for performance**
    const optionsMap = useMemo(() => ({
        companyName: filterOptions?.leadNames ?? [],
        salesmanName: filterOptions?.salesmen ?? [],
        stage: filterOptions?.stages ?? [],
        forecastCategory: filterOptions?.forecasts ?? [],
        gpPercentage: filterOptions?.gpPercentageRanges ?? [], // Corrected key from gpPercentageRanges to gpPercentage
    }), [filterOptions]);
    // **FIX END**

    const dateFilterLabels: { [key: string]: string } = {
        all_time: 'All Time', today: 'Today', tomorrow: 'Tomorrow', this_week: 'This Week', next_week: 'Next Week',
        this_month: 'This Month', next_month: 'Next Month', this_quarter: 'This Quarter', next_quarter: 'Next Quarter',
        this_year: 'This Year', next_year: 'Next Year', custom: 'Custom Range'
    };


    const handleDateSelect = (filter: string) => {
        setDateFilter(filter);
        setShowDateDropdown(false);
    }


    return (
        <div style={styles.pageContainer}>
            {/* <Sidebar/> */}
            <h1 style={styles.header}>Lead Reports</h1>
            <div style={styles.filtersContainer}>
                <div style={styles.filterGroup} ref={dateFilterRef}>
                    <strong>Closing Date:</strong>
                    <button style={styles.filterButton} onClick={() => setShowDateDropdown(s => !s)}>
                        <Calendar size={16} />
                        <span>{dateFilterLabels[dateFilter]}</span>
                    </button>
                    {showDateDropdown && (
                        <div style={{...styles.filterDropdown, left: 0, right: 'auto', minWidth: '200px'}}>
                            <div style={styles.optionsList}>
                                {Object.entries(dateFilterLabels).map(([key, label]) => (
                                    <div key={key} style={styles.dateDropdownItem} onMouseDown={() => handleDateSelect(key)}>{label}</div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
                {dateFilter === 'custom' && (
                    <div style={styles.filterGroup}>
                        <input type="date" value={customStartDate} onChange={e => setCustomStartDate(e.target.value)} style={styles.dateInput} />
                        <span>to</span>
                        <input type="date" value={customEndDate} onChange={e => setCustomEndDate(e.target.value)} style={styles.dateInput} />
                    </div>
                )}
            </div>
            <div style={styles.tableContainer}>
                <table style={styles.table}>
                    <thead>
                        {table.getHeaderGroups().map(headerGroup => (
                            <tr key={headerGroup.id}>
                                {headerGroup.headers.map(header => (
                                    <th key={header.id} style={styles.th}>
                                        {header.column.getCanFilter() && filterOptions ? (
                                            <FilterableHeader header={header} options={optionsMap[header.id] || []} />
                                        ) : (
                                            <div style={styles.headerContent} onClick={header.column.getToggleSortingHandler()}>
                                                {flexRender(header.column.columnDef.header, header.getContext())}
                                                {{ asc: ' ▲', desc: ' ▼' }[header.column.getIsSorted() as string] ?? ''}
                                            </div>
                                        )}
                                    </th>
                                ))}
                            </tr>
                        ))}
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr><td colSpan={columns.length} style={styles.loadingOrError}>Loading Data...</td></tr>
                        ) : error ? (
                             <tr><td colSpan={columns.length} style={{ ...styles.loadingOrError, color: '#ef4444' }}>{error}</td></tr>
                        ) : table.getRowModel().rows.length === 0 ? (
                            <tr><td colSpan={columns.length} style={styles.loadingOrError}>No results found for the selected filters.</td></tr>
                        ) : (
                            table.getRowModel().rows.map(row => (
                                <tr key={row.id}>
                                    {row.getVisibleCells().map(cell => (
                                        <td key={cell.id} style={styles.td}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</td>
                                    ))}
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
            <div style={styles.paginationContainer}>
                 <div>Rows per page:
                   <select value={table.getState().pagination.pageSize} onChange={e => { table.setPageSize(Number(e.target.value)) }} style={{ marginLeft: '0.5rem', padding: '0.25rem' }}>
                        {[10, 20, 50, 100].map(size => <option key={size} value={size}>{size}</option>)}
                   </select>
                 </div>
                <span>Page <strong>{pagination.pageIndex + 1} of {table.getPageCount() || 1}</strong> ({totalRows} total rows)</span>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button onClick={() => table.setPageIndex(0)} disabled={!table.getCanPreviousPage()}><ChevronsLeft size={20} /></button>
                    <button onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()}><ChevronLeft size={20} /></button>
                    <button onClick={() => table.nextPage()} disabled={!table.getCanNextPage()}><ChevronRight size={20} /></button>
                    <button onClick={() => table.setPageIndex(table.getPageCount() - 1)} disabled={!table.getCanNextPage()}><ChevronsRight size={20} /></button>
                </div>
            </div>
        </div>
    );
};


export default ReportsPage;