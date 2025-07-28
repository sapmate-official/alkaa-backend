/**
 * PDF Generation Configuration
 */
export const PDFConfig = {
    // Default PDF format ('html' or 'pdfkit')
    defaultFormat: 'html',
    
    // Puppeteer configuration
    puppeteer: {
        headless: true, // Always true for production
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--no-zygote',
            '--single-process',
            '--disable-gpu',
            '--disable-extensions',
            '--disable-background-timer-throttling',
            '--disable-backgrounding-occluded-windows',
            '--disable-renderer-backgrounding',
            '--disable-features=TranslateUI',
            '--disable-ipc-flooding-protection',
            '--disable-background-networking',
            '--disable-default-apps',
            '--disable-sync',
            '--metrics-recording-only',
            '--no-default-browser-check',
            '--no-pings',
            '--password-store=basic',
            '--use-mock-keychain',
            '--disable-component-extensions-with-background-pages',
            '--disable-permissions-api'
        ],
        timeout: 90000, // Increased timeout for stability
        // Windows-specific optimizations
        ...(process.platform === 'win32' && {
            executablePath: null, // Let Puppeteer find Chrome
            ignoreDefaultArgs: ['--disable-extensions']
        }),
        // Production settings
        defaultViewport: null,
        devtools: false
    },
    
    // PDF generation options
    pdfOptions: {
        format: 'A4',
        printBackground: true,
        margin: {
            top: '20px',
            right: '20px',
            bottom: '20px',
            left: '20px'
        },
        preferCSSPageSize: true,
        displayHeaderFooter: false,
        timeout: 0 // No timeout for PDF generation
    },
    
    // html-pdf configuration (alternative)
    htmlPdf: {
        format: 'A4',
        orientation: 'portrait',
        border: {
            top: '20px',
            right: '20px',
            bottom: '20px',
            left: '20px'
        },
        type: 'pdf',
        quality: '75',
        renderDelay: 2000, // Increased for better rendering
        timeout: 60000, // Increased timeout
        phantomArgs: ['--disk-cache=false', '--load-images=yes']
    },
    
    // Template configuration
    template: {
        // Company logo URL (can be local file path or URL)
        logoUrl: process.env.COMPANY_LOGO_URL || null,
        
        // Default company info (fallbacks)
        defaultCompany: {
            name: 'Your Company Name',
            address: 'Company Address',
            email: 'hr@company.com',
            phone: 'Company Phone'
        },
        
        // Color scheme
        colors: {
            primary: '#3b82f6',
            secondary: '#10b981',
            accent: '#f59e0b',
            text: '#1f2937',
            muted: '#6b7280'
        }
    },

    // Retry configuration
    retry: {
        maxAttempts: 3,
        delay: 1000, // 1 second between retries
        backoff: 1.5 // Exponential backoff multiplier
    }
};

/**
 * Environment-specific overrides
 */
if (process.env.NODE_ENV === 'production') {
    // Production optimizations
    PDFConfig.puppeteer.args.push(
        '--disable-web-security',
        '--disable-features=site-per-process'
    );
    PDFConfig.puppeteer.timeout = 120000; // 2 minutes for production
}

if (process.env.NODE_ENV === 'development') {
    // Development settings can be less strict
    PDFConfig.puppeteer.timeout = 60000;
    PDFConfig.puppeteer.devtools = true;
}
