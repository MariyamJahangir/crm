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
        <div className="flex items-center justify-between relative gap-2.5">
            <div className="flex items-center gap-1 cursor-pointer select-none" onClick={column.getToggleSortingHandler()}>
                {flexRender(column.columnDef.header, header.getContext())}
                {SortIcon && <SortIcon size={16} />}
            </div>
            <button
                onClick={(e) => { e.stopPropagation(); setShowFilter(s => !s); }}
                aria-label="Filter column"
                className="bg-white text-gray-700 border border-gray-300 px-2 py-1 rounded cursor-pointer flex items-center gap-1"
            >
                <ArrowDownNarrowWide size={16} />
            </button>
            {showFilter && (
                <div
                    ref={filterRef}
                    className="absolute top-full left-0 z-50 mt-2 bg-white border border-gray-300 rounded shadow-lg p-2 min-w-[240px]"
                    style={{ right: 'auto' }}
                >
                    <div className="max-h-[250px] overflow-y-auto">
                        {(options || []).map((option, index) => {
                            const isObject = typeof option === 'object' && option !== null && 'name' in option;
                            const value = isObject ? option.name : option;
                            const displayLabel = isObject
                                ? `${option.name} (${formatCurrency(option.valuation)})`
                                : option;

                            return (
                                <label key={`${value}-${index}`} className="flex items-center p-2 cursor-pointer rounded text-sm select-none hover:bg-gray-100">
                                    <input
                                        type="checkbox"
                                        checked={((column.getFilterValue() as string[]) || []).includes(value)}
                                        onChange={() => handleCheckboxChange(value)}
                                        className="mr-2 accent-sky-500 cursor-pointer"
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
                    className="text-grey-700 bg-transparent border-0 cursor-pointer p-0"
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
                        <a href={previewUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">
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
                let dateStyle = '';
                let tooltip = `Current: ${format(latestDate, 'MMM d, yyyy')}`;

                if (dates.length > 1) {
                    const prevDate = parseISO(dates[dates.length - 2]);
                    if (isAfter(latestDate, prevDate)) {
                        dateStyle = 'text-red-500 font-bold'; // Delayed
                        tooltip = `Delayed: ${format(prevDate, 'd MMM')} → ${format(latestDate, 'd MMM yyyy')}`;
                    } else if (isBefore(latestDate, prevDate)) {
                        dateStyle = 'text-green-500 font-bold'; // Advanced
                        tooltip = `Advanced: ${format(prevDate, 'd MMM')} ← ${format(latestDate, 'd MMM yyyy')}`;
                    }
                }
                return <span className={dateStyle} title={tooltip}>{format(latestDate, 'MMM d, yyyy')}</span>;
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
        { accessorKey: 'gpPercentage', header: 'GP %', enableColumnFilter: true, cell: info => `${Number(info.getValue<number>() || 0).toFixed(2)}%` },
        { accessorKey: 'createdAt', header: 'Created Date', enableColumnFilter: false, cell: info => format(parseISO(info.getValue<string>()), 'MMM d, yyyy') },
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
        <div className="flex min-h-screen z-10 transition-colors duration-300">
            <Sidebar />
            <div className="flex-1 overflow-y-auto h-screen">
                <div className="p-6 min-h-screen">
                    {/* <Sidebar/> */}
                    <h1 className="text-3xl font-bold text-gray-900">Lead Reports</h1>
                    <div className="my-6 p-4 bg-white rounded-lg shadow-sm flex flex-wrap items-center gap-4 z-20">
                        <div ref={dateFilterRef} className="flex items-center gap-2 flex-wrap relative">
                            <strong>Closing Date:</strong>
                            <button
                                className="bg-white text-gray-700 border border-gray-300 px-4 py-2 rounded cursor-pointer flex items-center gap-2"
                                onClick={() => setShowDateDropdown(s => !s)}
                            >
                                <Calendar size={16} />
                                <span>{dateFilterLabels[dateFilter]}</span>
                            </button>
                            {showDateDropdown && (
                                <div className="absolute top-full left-0 z-50 mt-2 bg-white border border-gray-300 rounded shadow-lg min-w-[200px] max-h-60 overflow-auto">
                                    <div>
                                        {Object.entries(dateFilterLabels).map(([key, label]) => (
                                            <div
                                                key={key}
                                                className="px-4 py-2 cursor-pointer hover:bg-gray-100 rounded"
                                                onMouseDown={() => handleDateSelect(key)}
                                            >
                                                {label}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                        {dateFilter === 'custom' && (
                            <div className="flex items-center gap-2">
                                <input
                                    type="date"
                                    value={customStartDate}
                                    onChange={e => setCustomStartDate(e.target.value)}
                                    className="px-2 py-1 border border-gray-300 rounded"
                                />
                                <span>to</span>
                                <input
                                    type="date"
                                    value={customEndDate}
                                    onChange={e => setCustomEndDate(e.target.value)}
                                    className="px-2 py-1 border border-gray-300 rounded"
                                />
                            </div>
                        )}
                    </div>


                    <div className="bg-cloud-50/30 dark:bg-midnight-900/30 backdrop-blur-xl border border-cloud-300/30 dark:border-midnight-700/30 rounded-2xl overflow-hidden shadow-2xl">
                        <div className="overflow-x-auto ">
                            <table className="w-full border-collapse">
                                <thead className='bg-cloud-100/40 sticky top-0 z-10 border-b backdrop-blur-md'>
                                    {table.getHeaderGroups().map(headerGroup => (
                                        <tr key={headerGroup.id}>
                                            {headerGroup.headers.map(header => (
                                                <th
                                                    key={header.id}
                                                    className="px-4 py-5 text-left text-sm text-center font-semibold text-midnight-700 uppercase bg-gray-100 whitespace-nowrap"
                                                >
                                                    {header.column.getCanFilter() && filterOptions ? (
                                                        <FilterableHeader header={header} options={optionsMap[header.id] || []} />
                                                    ) : (
                                                        <div className="flex items-center gap-1 cursor-pointer select-none" onClick={header.column.getToggleSortingHandler()}>
                                                            {flexRender(header.column.columnDef.header, header.getContext())}
                                                            {{ asc: ' ▲', desc: ' ▼' }[header.column.getIsSorted() as string] ?? ''}
                                                        </div>
                                                    )}
                                                </th>
                                            ))}
                                        </tr>
                                    ))}
                                </thead>
                                <tbody className='divide-y divide-cloud-200/40'>
                                    {loading ? (
                                        <tr>
                                            <td colSpan={columns.length} className="text-center py-8 text-midnight-700">Loading Data...</td>
                                        </tr>
                                    ) : error ? (
                                        <tr>
                                            <td colSpan={columns.length} className="text-center py-8 text-red-600">{error}</td>
                                        </tr>
                                    ) : table.getRowModel().rows.length === 0 ? (
                                        <tr>
                                            <td colSpan={columns.length} className="text-center py-8 text-midnight-700">No results found for the selected filters.</td>
                                        </tr>
                                    ) : (
                                        table.getRowModel().rows.map(row => (
                                            <tr key={row.id} className="hover:bg-cloud-200/40 dark:hover:bg-midnight-800/40 transition cursor-pointer">
                                                {row.getVisibleCells().map(cell => (
                                                    <td key={cell.id} className="px-4 py-3  text-sm text-gray-700 ">
                                                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                                                    </td>
                                                ))}
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>

                        <div className="px-4 py-3 bg-cloud-100/30 dark:bg-midnight-800/30 backdrop-blur-md flex flex-col sm:flex-row items-center justify-between gap-4 text-midnight-700 dark:text-ivory-300 select-none rounded-b-2xl">
                            <div className="text-sm">
                                Showing{" "}
                                <span className="font-semibold">{pagination.pageIndex * pagination.pageSize + 1}</span> to{" "}
                                <span className="font-semibold">{Math.min(pagination.pageIndex * pagination.pageSize + pagination.pageSize, totalRows)}</span> of{" "}
                                <span className="font-semibold">{totalRows}</span> results
                            </div>

                            <div className="flex items-center gap-3 flex-wrap">
                                <button
                                    onClick={() => table.setPageIndex(0)}
                                    disabled={!table.getCanPreviousPage()}
                                    className="w-8 h-8 flex items-center justify-center rounded-lg bg-cloud-200/50 dark:bg-midnight-700/50 hover:bg-cloud-300/70 dark:hover:bg-midnight-600/70 text-sm font-medium shadow-md transition disabled:opacity-40 disabled:cursor-not-allowed"
                                >
                                    «
                                </button>
                                <button
                                    onClick={() => table.previousPage()}
                                    disabled={!table.getCanPreviousPage()}
                                    className="w-8 h-8 flex items-center justify-center rounded-lg bg-cloud-200/50 dark:bg-midnight-700/50 hover:bg-cloud-300/70 dark:hover:bg-midnight-600/70 text-sm font-medium shadow-md transition disabled:opacity-40 disabled:cursor-not-allowed"
                                >
                                    ‹
                                </button>

                                {/* Page number buttons */}
                                <div className="flex items-center gap-1">
                                    {Array.from({ length: table.getPageCount() || 1 }, (_, i) => i).map(page => {
                                        const isCurrent = page === pagination.pageIndex;
                                        // Show only a range around current page for better UX:
                                        if (page < pagination.pageIndex - 3 || page > pagination.pageIndex + 3) return null;

                                        return (
                                            <button
                                                key={page}
                                                onClick={() => table.setPageIndex(page)}
                                                className={`w-8 h-8 flex items-center justify-center rounded-lg text-sm font-medium shadow-md transition ${isCurrent
                                                    ? "bg-sky-500 text-white"
                                                    : "bg-cloud-200/50 dark:bg-midnight-700/50 hover:bg-cloud-300/70 dark:hover:bg-midnight-600/70 text-midnight-700 dark:text-ivory-300"
                                                    }`}
                                            >
                                                {page + 1}
                                            </button>
                                        );
                                    })}
                                </div>

                                <button
                                    onClick={() => table.nextPage()}
                                    disabled={!table.getCanNextPage()}
                                    className="w-8 h-8 flex items-center justify-center rounded-lg bg-cloud-200/50 dark:bg-midnight-700/50 hover:bg-cloud-300/70 dark:hover:bg-midnight-600/70 text-sm font-medium shadow-md transition disabled:opacity-40 disabled:cursor-not-allowed"
                                >
                                    ›
                                </button>
                                <button
                                    onClick={() => table.setPageIndex((table.getPageCount() || 1) - 1)}
                                    disabled={!table.getCanNextPage()}
                                    className="w-8 h-8 flex items-center justify-center rounded-lg bg-cloud-200/50 dark:bg-midnight-700/50 hover:bg-cloud-300/70 dark:hover:bg-midnight-600/70 text-sm font-medium shadow-md transition disabled:opacity-40 disabled:cursor-not-allowed"
                                >
                                    »
                                </button>
                            </div>

                            <div className="text-sm">
                                Rows:
                                <select
                                    value={table.getState().pagination.pageSize}
                                    onChange={e => { table.setPageSize(Number(e.target.value)) }}
                                    className="border rounded-lg px-2 py-1 bg-white dark:bg-midnight-700/40 text-midnight-900 dark:text-ivory-300 text-sm ml-2"
                                >
                                    {[10, 20, 50, 100].map(size => <option key={size} value={size}>{size}</option>)}
                                </select>
                            </div>
                        </div>
                    </div>


                </div>
            </div>
        </div>
    );
};

export default ReportsPage;
