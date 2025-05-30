const { v4: uuidv4 } = require('uuid');
const databaseService = require('./database.service');

const securityQuestions = [
    "What is the name of your first pet?",
    "What is your mother's maiden name?",
    "What city were you born in?",
    "What is your favorite movie?",
    "What is the name of your first school?"
];

class Portal {
    constructor(username = null, password = null) {
        this.username = username;
        this.password = password;
    }
}

class PortalValidate extends Portal {
    static requiredFields = ['username', 'password'];

    validate() {
        for (const field of PortalValidate.requiredFields) {
            if (!this[field]) {
                throw new Error(`${field} is required`);
            }
        }
        return true;
    }
}

class SecurityQA {
    constructor(question = null, answer = null) {
        this.id = uuidv4();
        this.question = question;
        this.answer = answer;
    }
}

class SecurityQAValidate extends SecurityQA {
    static requiredFields = ['question', 'answer'];

    validate() {
        for (const field of SecurityQAValidate.requiredFields) {
            if (!this[field]) {
                throw new Error(`${field} is required`);
            }
        }
        return true;
    }
}

class PersonalInfo {
    constructor(firstName = null, lastName = null, identifier = null) {
        this.firstName = firstName;
        this.first_name = firstName;
        this.lastName = lastName;
        this.last_name = lastName;
        this.identifier = identifier;
    }

    get fullName() {
        const fname = this.firstName || this.first_name || '';
        const lname = this.lastName || this.last_name || '';
        return this.identifier 
            ? `${fname} ${lname} (${this.identifier})`
            : `${fname} ${lname}`;
    }
}

class PersonalInfoValidate extends PersonalInfo {
    static requiredFields = ['firstName', 'lastName'];

    validate() {
        for (const field of PersonalInfoValidate.requiredFields) {
            if (!this[field]) {
                throw new Error(`${field} is required`);
            }
        }
        return true;
    }
}

class JobbankData {
    constructor() {
        this.personal_info = new PersonalInfo();
        this.jobbank_portal = new Portal();
        this.jobbank_sqa = Array(5).fill(null).map(() => new SecurityQA());
    }
}

class JobbankValidate {
    constructor(personal_info, jobbank_portal = null, jobbank_sqa = null) {
        this.personal_info = personal_info;
        this.jobbank_portal = jobbank_portal;
        this.jobbank_sqa = jobbank_sqa;
    }

    get fullName() {
        return `${this.personal_info.firstName} ${this.personal_info.lastName}`;
    }

    validate() {
        if (this.personal_info instanceof PersonalInfoValidate) {
            this.personal_info.validate();
        }
        if (this.jobbank_portal instanceof PortalValidate) {
            this.jobbank_portal.validate();
        }
        if (this.jobbank_sqa) {
            for (const qa of this.jobbank_sqa) {
                if (qa instanceof SecurityQAValidate) {
                    qa.validate();
                }
            }
        }
        return true;
    }
}

class Jobbank extends JobbankData {
    constructor() {
        super();
        this._id = null;
        this.ownerIds = [];
    }

    get selector() {
        return this.personal_info.fullName;
    }

    static async findOne(query) {
        const collection = await databaseService.getCollection('jobbank');
        return await collection.findOne(query);
    }

    static async find(query) {
        const collection = await databaseService.getCollection('jobbank');
        return await collection.find(query).toArray();
    }

    static async getById(id) {
        const { ObjectId } = require('mongodb');
        const collection = await databaseService.getCollection('jobbank');
        return await collection.findOne({ _id: new ObjectId(id) });
    }

    async save() {
        const collection = await databaseService.getCollection('jobbank');
        if (this._id) {
            return await collection.updateOne(
                { _id: this._id },
                { $set: this },
                { upsert: true }
            );
        } else {
            const result = await collection.insertOne(this);
            this._id = result.insertedId;
            return result;
        }
    }
}

const jobbankCache = new Map();

async function getJobbanks(userId) {
    const cacheKey = userId.toString();
    
    if (jobbankCache.has(cacheKey)) {
        return jobbankCache.get(cacheKey);
    }

    const jobbanks = await Jobbank.find({ ownerIds: userId });
    jobbankCache.set(cacheKey, jobbanks);
    
    return jobbanks;
}

module.exports = {
    Portal,
    PortalValidate,
    SecurityQA,
    SecurityQAValidate,
    PersonalInfo,
    PersonalInfoValidate,
    JobbankData,
    JobbankValidate,
    Jobbank,
    getJobbanks,
    securityQuestions
};