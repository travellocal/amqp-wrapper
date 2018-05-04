import * as chai from "chai";
import chaiThings = require("chai-things");
import chaiAsPromised = require("chai-as-promised");
chai.use(chaiThings);
chai.use(chaiAsPromised);
const expect = chai.expect;
chai.config.truncateThreshold = 0;

export { expect };
