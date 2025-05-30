const { chromium } = require('playwright');
const { Jobbank } = require('./jobbank.service');

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const randomDelay = async (msg = "", minSeconds = 1, maxSeconds = 5) => {
    console.log(`${new Date().toLocaleTimeString()}: ${msg}`);
    await sleep(Math.random() * (maxSeconds - minSeconds) * 1000 + minSeconds * 1000);
};

class JobbankInviterService {
    constructor(jobbank, logger = console.log, timeout = 100000) {
        this.jobbank = jobbank;
        this.invited = 0;
        this.errors = [];
        this.completed = [];
        this.logger = logger;
        this.timeout = timeout;
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
        const browser = await chromium.launch({
            headless,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-infobars',
                '--ignore-certifcate-errors',
                '--ignore-certifcate-errors-spki-list',
                `--user-agent=${userAgents[Math.floor(Math.random() * userAgents.length)]}`
            ]
        });

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
        const browser = await chromium.launch({
            headless,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-infobars',
                '--ignore-certifcate-errors',
                '--ignore-certifcate-errors-spki-list',
                `--user-agent=${userAgents[Math.floor(Math.random() * userAgents.length)]}`
            ]
        });

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
            
            this.logger(`Processing job post ${jobPostId} (${i + 1}/${jobPosts.length})...`);
            
            // Reset counters for this job
            const startInvited = this.invited;
            
            // Only login on first job
            if (!loggedIn) {
                const loginSuccess = await this.loginJobbank(page);
                if (!loginSuccess) {
                    this.errors.push(`Failed to login for job ${jobPostId}`);
                    results.push({ jobPostId, invited: 0, error: 'Login failed' });
                    continue;
                }
                loggedIn = true;
            }
            
            // Process the job post
            await this.goToJobPost(page, jobPostId, itemsPerPage);
            
            // Execute the actual invitation process (same logic as single job)
            let fullProfileButton = await this.getAllFullProfileButtons(page, minimumStars);
            let jobInvitationCount = 0;
            
            this.logger(`🔄 Starting invitation loop. Found button: ${fullProfileButton ? 'YES' : 'NO'}`);
            
            while (fullProfileButton) {
                try {
                    this.logger(`🎯 Attempting to invite candidate #${jobInvitationCount + 1}...`);
                    
                    // Click on candidate profile
                    await fullProfileButton.click();
                    
                    // Find and click the "Invite to apply" button
                    const itaButton = page.locator('input:has-text("Invite to apply")');
                    await itaButton.scrollIntoViewIfNeeded();
                    await itaButton.click();
                    
                    // Go back to candidate list
                    this.logger(`📧 Invitation sent! Going back to candidate list...`);
                    await page.goBack();
                    this.invited++;
                    jobInvitationCount++;
                    
                    await page.waitForLoadState('networkidle', { timeout: this.timeout });
                    
                    // Look for next candidate
                    fullProfileButton = await this.getAllFullProfileButtons(page, minimumStars);
                } catch (error) {
                    this.logger(`❌ Error inviting candidate: ${error.message}`);
                    this.errors.push(`Error inviting candidate: ${error.message}`);
                    break;
                }
            }
            
            const invitedForThisJob = this.invited - startInvited;
            results.push({ jobPostId, invited: invitedForThisJob });
            
            this.logger(`Completed job ${jobPostId}: ${invitedForThisJob} invitations sent`);
            
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
        return { results, totalInvited: this.invited, errors: this.errors };
    }

    async jobbankPostInvite(page, jobId, invitationStar, itemsPerPage) {
        const loginSuccess = await this.loginJobbank(page);
        if (!loginSuccess) {
            if (this.errors[this.errors.length - 1] === 'Session expired') {
                this.errors.pop();
                await randomDelay('session expired');
                this.logger('Session expired. Try to login again...');
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
                await fullProfileButton.click();
                const itaButton = page.locator('input:has-text("Invite to apply")');
                await itaButton.scrollIntoViewIfNeeded();
                await itaButton.click();
                await page.goBack();
                this.invited++;
                await page.waitForLoadState('networkidle', { timeout: this.timeout });
                fullProfileButton = await this.getAllFullProfileButtons(page, invitationStar);
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
        this.logger(`Navigating to advertisement id ${jobId}...`);
        await randomDelay('before go to job post');
        const url = `https://employer.jobbank.gc.ca/employer/match/dashboard/${jobId}`;
        await page.goto(url);
        await randomDelay('after go to job post');
        await page.waitForLoadState('networkidle', { timeout: this.timeout });

        const navigateCheckSuccess = await this.checkSuccess(
            page,
            'a.app-name:text("Job Bank")',
            'h1:text("HTTP Error 404 - Not Found")',
            'span.objectStatus.stateNeutral:text("Job posting pending review")'
        );
        if (!navigateCheckSuccess) {
            this.logger(`Job post ${jobId} not found or Job post is pending. Please check it in Job Posts.`);
            this.errors.push(`Job post ${jobId} not found or Job post is pending. Please check it in Job Posts.`);
            return false;
        }

        await page.selectOption('select[name="matchlistpanel_length"]', String(itemsPerPage));
        await page.waitForLoadState('networkidle', { timeout: this.timeout });
        await this.sortScore(page);
        this.logger(`Successfully navigated to advertisement id ${jobId}`);
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
    }

    async getNextPage(page, invitationStar) {
        this.logger('Moving to next page...');
        await page.click('#matchlistpanel_next');
        await page.waitForLoadState('networkidle', { timeout: this.timeout });
        return await this.getFullProfileButton(page, invitationStar);
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