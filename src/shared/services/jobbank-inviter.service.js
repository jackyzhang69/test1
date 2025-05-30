const { chromium } = require('playwright');
const { Jobbank } = require('./jobbank.service');
const { getBundledChromiumPath } = require('../utils/config');

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const randomDelay = async (msg = "", minSeconds = 1, maxSeconds = 5) => {
    console.log(`${new Date().toLocaleTimeString()}: ${msg}`);
    await sleep(Math.random() * (maxSeconds - minSeconds) * 1000 + minSeconds * 1000);
};

class JobbankInviterService {
    constructor(jobbank, logger = console.log, timeout = 30000) {
        this.jobbank = jobbank;
        this.invited = 0;
        this.errors = [];
        this.completed = [];
        this.logger = logger;
        this.timeout = timeout;
    }

    /**
     * Check if an error should not be retried (permanent failure)
     * @param {string} errorMessage 
     * @returns {boolean}
     */
    isNonRetryableError(errorMessage) {
        const nonRetryablePatterns = [
            'Password or username is incorrect',
            'Missing jobbank portal credentials',
            'Security question answer is incorrect',
            'Job post .* not found',
            'Job post .* is pending',
            'Job post .* has no candidates',
            'Job post .* invalid',
            'HTTP Error 404',
            'No answer found for security question',
            'Please check it in Job Posts'
        ];
        return nonRetryablePatterns.some(pattern => 
            new RegExp(pattern, 'i').test(errorMessage));
    }

    /**
     * Retry wrapper with status updates
     * @param {Function} operation 
     * @param {number} maxRetries 
     * @param {string} operationName 
     * @returns {Promise<any>}
     */
    async retryWithStatus(operation, maxRetries = 3, operationName) {
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                return await operation();
            } catch (error) {
                if (this.isNonRetryableError(error.message)) {
                    throw error; // Don't retry permanent failures
                }
                
                if (attempt < maxRetries) {
                    this.logger(`⚠️ ${operationName} failed (attempt ${attempt}/${maxRetries}). Retrying...`);
                    await randomDelay('retry delay', 2, 4);
                } else {
                    this.logger(`❌ ${operationName} failed after ${maxRetries} attempts`);
                    throw error; // Max retries reached
                }
            }
        }
    }

    async screen(page, name) {
        await sleep(5000);
    }

    async inviteJobPost(jobId, invitationStar, itemsPerPage = 100) {
        const userAgents = [
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/58.0.3029.110 Safari/537.3",
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_4) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/58.0.3029.110 Safari/537.36",
            "Mozilla/5.0 (Windows NT 10.0; Win64; rv:89.0) Gecko/20100101 Firefox/89.0"
        ];

        const headless = process.env.environment === 'dev' ? false : true;
        
        // Get bundled Chromium path if available
        const bundledChromiumPath = getBundledChromiumPath();
        const launchOptions = {
            headless,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-infobars',
                '--ignore-certifcate-errors',
                '--ignore-certifcate-errors-spki-list',
                `--user-agent=${userAgents[Math.floor(Math.random() * userAgents.length)]}`
            ]
        };
        
        // Use bundled Chromium if available (for packaged app)
        if (bundledChromiumPath) {
            launchOptions.executablePath = bundledChromiumPath;
            console.log(`✅ Using bundled Chromium: ${bundledChromiumPath}`);
        } else {
            console.log('⚠️ Using system Playwright Chromium (no bundled Chromium found)');
            console.log(`PLAYWRIGHT_BROWSERS_PATH: ${process.env.PLAYWRIGHT_BROWSERS_PATH || 'not set'}`);
        }
        
        const browser = await chromium.launch(launchOptions);

        const page = await browser.newPage();
        page.setDefaultNavigationTimeout(this.timeout);
        page.setDefaultTimeout(this.timeout);
        page.on('dialog', dialog => this.handleDialog(dialog));
        await page.setViewportSize({ width: 1920, height: 1440 });

        await this.jobbankPostInvite(page, jobId, invitationStar, itemsPerPage);

        await browser.close();
        return this;
    }
    
    async inviteMultipleJobPosts(jobPosts, itemsPerPage = 100) {
        const userAgents = [
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/58.0.3029.110 Safari/537.3",
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_4) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/58.0.3029.110 Safari/537.36",
            "Mozilla/5.0 (Windows NT 10.0; Win64; rv:89.0) Gecko/20100101 Firefox/89.0"
        ];

        const headless = process.env.environment === 'dev' ? false : true;
        
        // Get bundled Chromium path if available
        const bundledChromiumPath = getBundledChromiumPath();
        const launchOptions = {
            headless,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-infobars',
                '--ignore-certifcate-errors',
                '--ignore-certifcate-errors-spki-list',
                `--user-agent=${userAgents[Math.floor(Math.random() * userAgents.length)]}`
            ]
        };
        
        // Use bundled Chromium if available (for packaged app)
        if (bundledChromiumPath) {
            launchOptions.executablePath = bundledChromiumPath;
            console.log(`✅ Using bundled Chromium: ${bundledChromiumPath}`);
        } else {
            console.log('⚠️ Using system Playwright Chromium (no bundled Chromium found)');
            console.log(`PLAYWRIGHT_BROWSERS_PATH: ${process.env.PLAYWRIGHT_BROWSERS_PATH || 'not set'}`);
        }
        
        const browser = await chromium.launch(launchOptions);

        const page = await browser.newPage();
        page.setDefaultNavigationTimeout(this.timeout);
        page.setDefaultTimeout(this.timeout);
        page.on('dialog', dialog => this.handleDialog(dialog));
        await page.setViewportSize({ width: 1920, height: 1440 });
        
        let loggedIn = false;
        const results = [];
        
        for (let i = 0; i < jobPosts.length; i++) {
            const { jobPostId, minimumStars } = jobPosts[i];
            
            // Send overall progress update at the start of each job
            if (this.overallProgressCallback) {
                this.overallProgressCallback(i, jobPosts.length, jobPostId);
            }
            
            this.logger(`🚀 STARTING Job Post ${jobPostId} (${i + 1}/${jobPosts.length}) - Stars: ${minimumStars}`);
            
            // Force a test message to ensure logger is working
            this.logger(`🔧 DEBUG: Logger test for job ${jobPostId} - If you see this message, logger is working correctly`);
            
            // Reset counters for this job
            const startInvited = this.invited;
            
            // Only login on first job
            if (!loggedIn) {
                const loginSuccess = await this.loginJobbank(page);
                if (!loginSuccess) {
                    const errorMsg = `❌ Failed to login for job ${jobPostId}`;
                    this.logger(errorMsg);
                    this.errors.push(`Failed to login for job ${jobPostId}`);
                    results.push({ jobPostId, invited: 0, error: 'Login failed' });
                    continue;
                }
                loggedIn = true;
            }
            
            // Process the job post
            const navigateSuccess = await this.goToJobPost(page, jobPostId, itemsPerPage);
            if (!navigateSuccess) {
                // Job post not found or invalid - skip this job
                const errorMsg = `❌ Job post ${jobPostId} not found or invalid. Skipping to next job...`;
                this.logger(errorMsg);
                results.push({ jobPostId, invited: 0, error: 'Job post not found or invalid' });
                continue;
            }
            
            // Execute the actual invitation process (same logic as single job)
            let fullProfileButton = await this.getAllFullProfileButtons(page, minimumStars);
            let jobInvitationCount = 0;
            
            this.logger(`🔄 Starting invitation loop. Found button: ${fullProfileButton ? 'YES' : 'NO'}`);
            
            while (fullProfileButton) {
                try {
                    this.logger(`🎯 Attempting to invite candidate #${jobInvitationCount + 1}...`);
                    
                    // Invite candidate with retry logic
                    await this.retryWithStatus(async () => {
                        // Click on candidate profile
                        await fullProfileButton.click();
                        
                        // Find and click the "Invite to apply" button
                        const itaButton = page.locator('input:has-text("Invite to apply")');
                        await itaButton.scrollIntoViewIfNeeded();
                        await itaButton.click();
                        
                        // Go back to candidate list
                        await page.goBack();
                        await page.waitForLoadState('networkidle', { timeout: this.timeout });
                    }, 2, `Candidate invitation #${jobInvitationCount + 1}`);
                    
                    this.logger(`📧 Invitation sent! Going back to candidate list...`);
                    this.invited++;
                    jobInvitationCount++;
                    
                    // Look for next candidate
                    fullProfileButton = await this.getAllFullProfileButtons(page, minimumStars);
                } catch (error) {
                    if (this.isNonRetryableError(error.message)) {
                        this.logger(`❌ Permanent error in job ${jobPostId}: ${error.message}. Stopping this job.`);
                        this.errors.push(`Job ${jobPostId} - Error inviting candidate: ${error.message}`);
                        break;
                    } else {
                        this.logger(`⚠️ Failed to invite candidate in job ${jobPostId}: ${error.message}. Continuing with next candidate...`);
                        this.errors.push(`Job ${jobPostId} - Error inviting candidate: ${error.message}`);
                        // Continue with next candidate instead of breaking
                        fullProfileButton = await this.getAllFullProfileButtons(page, minimumStars);
                    }
                }
            }
            
            const invitedForThisJob = this.invited - startInvited;
            results.push({ jobPostId, invited: invitedForThisJob });
            
            // Send detailed completion message
            if (invitedForThisJob > 0) {
                this.logger(`✅ Completed job ${jobPostId}: ${invitedForThisJob} invitations sent successfully`);
            } else {
                this.logger(`⚠️ Completed job ${jobPostId}: No invitations sent (no qualifying candidates found)`);
            }
            
            // Send job completion callback
            if (this.jobCompleteCallback) {
                this.jobCompleteCallback(jobPostId, invitedForThisJob);
            }
        }
        
        // Logout after all jobs are done
        if (loggedIn) {
            await this.logoutJobbank(page);
        }
        
        await browser.close();
        
        // Send detailed final summary
        const successfulJobs = results.filter(r => r.invited > 0);
        const failedJobs = results.filter(r => r.error);
        const noInvitesJobs = results.filter(r => !r.error && r.invited === 0);
        
        this.logger(`📊 === FINAL SUMMARY ===`);
        this.logger(`总计处理 ${jobPosts.length} 个 job posts，发送 ${this.invited} 个邀请`);
        
        if (successfulJobs.length > 0) {
            this.logger(`✅ 成功的 Job Posts (${successfulJobs.length}个):`);
            successfulJobs.forEach(job => {
                this.logger(`  • Job ${job.jobPostId}: ${job.invited} 个邀请发送成功`);
            });
        }
        
        if (noInvitesJobs.length > 0) {
            this.logger(`⚠️ 无邀请发送的 Job Posts (${noInvitesJobs.length}个):`);
            noInvitesJobs.forEach(job => {
                this.logger(`  • Job ${job.jobPostId}: 没有符合条件的候选人`);
            });
        }
        
        if (failedJobs.length > 0) {
            this.logger(`❌ 失败的 Job Posts (${failedJobs.length}个):`);
            failedJobs.forEach(job => {
                this.logger(`  • Job ${job.jobPostId}: ${job.error}`);
            });
        }
        
        this.logger(`======================`);
        
        return { results, totalInvited: this.invited, errors: this.errors };
    }

    async jobbankPostInvite(page, jobId, invitationStar, itemsPerPage) {
        const loginSuccess = await this.loginJobbank(page);
        if (!loginSuccess) {
            if (this.errors[this.errors.length - 1] === 'Session expired') {
                this.errors.pop();
                this.logger('🔄 Session expired. Retrying login...');
                await randomDelay('session expired');
                const retrySuccess = await this.loginJobbank(page, true);
                if (!retrySuccess) {
                    return;
                }
            } else {
                return;
            }
        }

        try {
            await page.locator('span.h3:text("Loading, please wait...")').waitFor({ state: 'hidden' });
            
            const closeButton = await page.$('input[value="Close"]');
            if (closeButton) {
                await randomDelay('close modal');
                await page.click('input[value="Close"]');
            }

            const navigateSuccess = await this.goToJobPost(page, jobId, itemsPerPage);
            if (!navigateSuccess) {
                return;
            }

            let fullProfileButton = await this.getAllFullProfileButtons(page, invitationStar);

            while (fullProfileButton) {
                try {
                    // Invite candidate with retry logic
                    await this.retryWithStatus(async () => {
                        await fullProfileButton.click();
                        const itaButton = page.locator('input:has-text("Invite to apply")');
                        await itaButton.scrollIntoViewIfNeeded();
                        await itaButton.click();
                        await page.goBack();
                        await page.waitForLoadState('networkidle', { timeout: this.timeout });
                    }, 2, `Candidate invitation #${this.invited + 1}`);
                    
                    this.invited++;
                    fullProfileButton = await this.getAllFullProfileButtons(page, invitationStar);
                } catch (error) {
                    if (this.isNonRetryableError(error.message)) {
                        this.logger(`❌ Permanent error inviting candidate: ${error.message}`);
                        this.errors.push(`Error inviting candidate: ${error.message}`);
                        break;
                    } else {
                        this.logger(`❌ Failed to invite candidate after retries: ${error.message}`);
                        this.errors.push(`Error inviting candidate: ${error.message}`);
                        // Continue with next candidate
                        fullProfileButton = await this.getAllFullProfileButtons(page, invitationStar);
                    }
                }
            }

            const message = this.invited > 0 
                ? `Total invited: ${this.invited} candidates`
                : 'Invitation checked but no one qualified';
            this.completed.push(message);

        } catch (error) {
            const errorMessage = this.invited === 0
                ? `Invitation error: ${error.message}`
                : `Network error, but have invited ${this.invited} candidates already`;
            this.errors.push(errorMessage);
        }

        // Don't logout here - will be handled by the caller
    }

    handleDialog(dialog) {
        this.logger(`Dialog message: ${dialog.message()}`);
        dialog.dismiss();
    }

    async checkSuccess(page, successSelector, errorSelector, otherIssueSelector = null) {
        try {
            const selectors = otherIssueSelector 
                ? `${errorSelector}, ${successSelector}, ${otherIssueSelector}`
                : `${errorSelector}, ${successSelector}`;
            
            await page.waitForSelector(selectors, { timeout: this.timeout });

            if (await page.$(errorSelector)) {
                return false;
            } else if (otherIssueSelector && await page.$(otherIssueSelector)) {
                return false;
            } else if (await page.$(successSelector)) {
                return true;
            } else {
                throw new Error('Unexpected element matched');
            }
        } catch (error) {
            const msg = this.invited === 0
                ? `Invitation error: ${error.message}`
                : `Network error, but have invited ${this.invited} candidates already`;
            this.errors.push(msg);
            return false;
        }
    }

    async loginJobbank(page, retry = false) {
        this.logger('Logging in to Jobbank...');
        
        if (retry) {
            await page.getByRole('link', { name: 'Sign in' }).click();
        } else {
            await page.goto('https://employer.jobbank.gc.ca/employer/');
        }

        const username = this.jobbank.jobbank_portal?.username || this.jobbank.jobbank_portal?.email;
        const password = this.jobbank.jobbank_portal?.password;
        
        if (!username || !password) {
            this.logger('Missing jobbank portal credentials');
            this.errors.push('Missing jobbank portal credentials');
            return false;
        }
        
        await page.fill('input[name="loginForm:input-email"]', username);
        await randomDelay('after fill username');
        await page.fill('input[name="loginForm:input-password"]', password);
        await randomDelay('after fill password');
        await page.click('button:has-text("Sign in")');
        await randomDelay('after click sign in');

        const loginCheckSuccess = await this.checkSuccess(page, 'span.field-name', 'span.error');
        if (!loginCheckSuccess) {
            this.logger('Password or username is incorrect');
            this.errors.push('Password or username is incorrect');
            return false;
        }

        const question = await page.locator('span.field-name').innerText();
        const qaList = this.jobbank.jobbank_sqa || [];
        const answer = this.getAnswer(question, qaList.map(qa => [qa.question, qa.answer]));
        
        if (!answer) {
            this.logger(`No answer found for security question: ${question}`);
            this.errors.push(`No answer found for security question: ${question}`);
            return false;
        }
        
        await page.fill('input[name="securityForm:input-security-answer"]', answer);
        await randomDelay('after fill security answer');
        await page.click('button:has-text("Continue")');

        const securityCheckSuccess = await this.checkSuccess(
            page,
            'h2.wb-inv:has-text("Account menu")',
            'span.error'
        );
        if (!securityCheckSuccess) {
            this.logger('Security question answer is incorrect. Please check your RCIC account in settings.');
            this.errors.push('Security question answer is incorrect. Please check your RCIC account in settings.');
            return false;
        }

        const sessionExpired = await page.$('h1:text("Session expired")');
        if (sessionExpired) {
            await randomDelay('get session expired');
            this.errors.push('Session expired');
            return false;
        }

        await page.waitForSelector('//span[text()="View advertised jobs"]', { timeout: this.timeout });
        this.logger('Successfully logged in to Jobbank');
        return true;
    }

    async logoutJobbank(page) {
        this.logger('Logging out from Jobbank...');
        await page.locator('(//button[@class="btn dropdown-toggle"])[1]').click();
        await page.getByRole('link', { name: 'Sign out' }).click();
        await page.waitForLoadState('networkidle', { timeout: this.timeout });
        this.logger('Successfully logged out from Jobbank');
    }

    async goToJobPost(page, jobId, itemsPerPage) {
        this.logger(`🔄 Navigating to advertisement id ${jobId}...`);
        
        // Navigation with retry for network issues
        try {
            await this.retryWithStatus(async () => {
                await randomDelay('before go to job post');
                const url = `https://employer.jobbank.gc.ca/employer/match/dashboard/${jobId}`;
                this.logger(`📍 Loading URL: ${url}`);
                await page.goto(url);
                await randomDelay('after go to job post');
                await page.waitForLoadState('networkidle', { timeout: this.timeout });
            }, 3, 'Page navigation');
        } catch (error) {
            const errorMsg = `❌ Failed to navigate to job post ${jobId}: ${error.message}`;
            this.logger(errorMsg);
            this.errors.push(errorMsg);
            return false;
        }

        // Get page title and URL for debugging
        const pageTitle = await page.title();
        const currentUrl = page.url();
        const expectedUrl = `https://employer.jobbank.gc.ca/employer/match/dashboard/${jobId}`;
        this.logger(`📄 Page loaded - Title: "${pageTitle}", URL: ${currentUrl}`);
        
        // Check if we were redirected away from the job post
        if (!currentUrl.includes(`/dashboard/${jobId}`)) {
            const errorMsg = `❌ Job post ${jobId} - Page redirected to ${currentUrl}. This job post may not exist or you may not have access to it.`;
            this.logger(errorMsg);
            this.errors.push(errorMsg);
            return false;
        }

        // Check for obvious errors first (don't retry these)
        const errorSelectors = [
            'h1:text("HTTP Error 404 - Not Found")',
            'span.objectStatus.stateNeutral:text("Job posting pending review")',
            'h1:contains("Page not found")',
            'h1:contains("Invalid")',
            '.error-message',
            'h1:contains("Error")',
            'h1:contains("not found")',
            'h2:contains("not found")',
            '.alert-danger',
            '.error'
        ];
        
        this.logger(`🔍 Checking for error indicators on page...`);
        for (const selector of errorSelectors) {
            try {
                const element = await page.$(selector);
                if (element) {
                    const text = await element.textContent();
                    const errorMsg = `❌ Job post ${jobId} error detected: "${text}". Please check it in Job Posts.`;
                    this.logger(errorMsg);
                    this.errors.push(errorMsg);
                    return false;
                }
            } catch (e) {
                // Selector might not exist, continue checking
            }
        }

        // Check if we have the expected job bank interface
        this.logger(`🔍 Checking for Job Bank interface...`);
        const hasJobBankInterface = await page.$('a.app-name:text("Job Bank")');
        if (!hasJobBankInterface) {
            const errorMsg = `❌ Job post ${jobId} - Job Bank interface not found. This may be an invalid job post or permission issue.`;
            this.logger(errorMsg);
            this.errors.push(errorMsg);
            return false;
        }
        this.logger(`✅ Job Bank interface found`);

        // Verify the candidate table exists (key indicator of valid job post)
        this.logger(`🔍 Checking for candidate matching table...`);
        try {
            await page.waitForSelector('select[name="matchlistpanel_length"]', { timeout: 10000 });
            this.logger(`✅ Candidate matching table found`);
        } catch (error) {
            // This is a critical failure - no candidate table means invalid job post
            const bodyText = await page.textContent('body').catch(() => 'Unable to read page content');
            
            // Check if we're on the dashboard homepage (common redirect for invalid job posts)
            if (currentUrl.includes('/employer/dashboard') && !currentUrl.includes(`/dashboard/${jobId}`)) {
                const errorMsg = `❌ Job post ${jobId} - Redirected to dashboard homepage. This job post ID does not exist.`;
                this.logger(errorMsg);
                this.errors.push(errorMsg);
                return false;
            }
            
            const errorMsg = `❌ Job post ${jobId} - No candidate matching table found. This job post may not exist, be inactive, or have no candidates available.`;
            this.logger(errorMsg);
            this.logger(`📋 Page content preview: ${bodyText.substring(0, 300)}...`);
            this.errors.push(errorMsg);
            return false;
        }

        // Page setup with retry for temporary loading issues
        this.logger(`⚙️ Setting up page for job post ${jobId}...`);
        await this.retryWithStatus(async () => {
            await page.selectOption('select[name="matchlistpanel_length"]', String(itemsPerPage));
            await page.waitForLoadState('networkidle', { timeout: this.timeout });
            await this.sortScore(page);
        }, 3, 'Page setup');
        
        // Final validation before declaring success
        const finalUrl = page.url();
        const hasMatchTable = await page.$('select[name="matchlistpanel_length"]');
        
        if (!finalUrl.includes(`/dashboard/${jobId}`) || !hasMatchTable) {
            const errorMsg = `❌ FINAL CHECK FAILED for job post ${jobId} - URL: ${finalUrl}, HasMatchTable: ${!!hasMatchTable}`;
            this.logger(errorMsg);
            this.errors.push(errorMsg);
            return false;
        }
        
        this.logger(`✅ Successfully navigated to and set up job post ${jobId} - Ready to process candidates`);
        this.logger(`🔧 FINAL DEBUG: Job ${jobId} passed all checks - URL contains ${jobId}: ${finalUrl.includes(`/dashboard/${jobId}`)}, Match table exists: ${!!hasMatchTable}`);
        return true;
    }

    async sortScore(page) {
        this.logger('Sorting scores in descending order...');
        const element = page.locator('//span[text()="Score"]');
        await element.click();
        await element.click();
        this.logger('Scores sorted in descending order');
    }

    async hasNext(page) {
        const nextButton = page.locator('#matchlistpanel_next');
        return nextButton ? await nextButton.isVisible() : false;
    }

    async getAllFullProfileButtons(page, invitationStar) {
        this.logger(`Searching for candidates with score >= ${invitationStar}...`);
        
        return await this.retryWithStatus(async () => {
            let fullProfileButton = await this.getFullProfileButton(page, invitationStar);
            
            if (!fullProfileButton) {
                while (await this.hasNext(page)) {
                    fullProfileButton = await this.getNextPage(page, invitationStar);
                    if (fullProfileButton) {
                        break;
                    }
                }
            }
            return fullProfileButton;
        }, 3, 'Candidate search');
    }

    async getNextPage(page, invitationStar) {
        this.logger('Moving to next page...');
        
        return await this.retryWithStatus(async () => {
            await page.click('#matchlistpanel_next');
            await page.waitForLoadState('networkidle', { timeout: this.timeout });
            return await this.getFullProfileButton(page, invitationStar);
        }, 3, 'Page navigation');
    }

    async getFullProfileButton(page, invitationStar) {
        await page.waitForSelector('#matchlistpanel tbody tr', { timeout: this.timeout });
        const rows = await page.locator('#matchlistpanel tbody tr').all();

        for (let index = 0; index < rows.length; index++) {
            const row = rows[index];
            this.logger(`Processing row ${index + 1} of ${rows.length}`);
            // Send progress update for current candidate
            if (this.progressCallback) {
                this.progressCallback(index + 1, rows.length);
            }
            const scoreText = await row.locator('td:nth-child(3)').innerText();
            const invitedText = await row.locator('td:nth-child(9)').innerText();
            const score = this.getScore(scoreText);

            if (score < invitationStar) {
                this.logger(`Score ${score} is below threshold ${invitationStar}. Stopping search.`);
                break;
            }

            if (invitedText === 'Not invited to apply') {
                this.logger(`Found candidate to invite at row ${index + 1}`);
                return row.locator('td:nth-child(1)');
            }
        }

        return null;
    }

    getScore(scoreText) {
        const match = scoreText.match(/(\d+(?:\.\d+)?) out of 5/);
        return match ? parseFloat(match[1]) : 0;
    }

    getAnswer(question, qaList) {
        for (const qa of qaList) {
            if (question === qa[0]) {
                return qa[1];
            }
        }
        return '';
    }
}

module.exports = { JobbankInviterService };