const EventEmitter = require("events").EventEmitter;

class ApiServer {
  constructor() {
    this.timeout = [1, 2, 5, 10];
    this.isTimeout = [true, true, true, true];

    this.callApi.bind(this);
  }

  async callApi({ endpoint, endpointDataToPass }) {
    if (this.isTimeout[endpoint - 1]) {
      this.isTimeout[endpoint - 1] = false;

      throw {
        result: {
          status: 429,
          timeout: this.timeout[endpoint - 1],
        },
      };
    }

    this.isTimeout[endpoint - 1] = true;
    setTimeout(() => {
      this.isTimeout[endpoint - 1] = false;
    }, this.timeout[endpoint - 1]);
    return {
      result: {
        status: 200,
        data: endpointDataToPass,
      },
    };
  }
}

class Queue extends EventEmitter {
  constructor() {
    super();
    this.timeout = 1000;
    this.tasks = [];
    this.run = false;

    this.on("start", () => {
      if (!this.run) {
        this.run = true;
        this.emit("next");
      }
    });

    this.on("next", async () => {
      let i = 0;
      const now = new Date().getTime();
      while (i < this.tasks.length) {
        if (this.tasks[i].timeout === null || now > this.tasks[i].timeout) {
          try {
            const response = await this.worker(this.tasks[i]);
            console.log("Success:", this.tasks[i].endpoint);
            this.consume(response.result.data, this.tasks[i].consumerType);
            this.tasks.splice(i, 1);
          } catch (err) {
            console.log("Error:", this.tasks[i].endpoint);
            const d = new Date();
            d.setSeconds(d.getSeconds() + err.result.timeout);
            this.tasks[i].timeout = d.getTime();
          }
          break;
        }
        i++;
      }
      process.nextTick(() => {
        setTimeout(() => {
          this.emit("next");
        }, this.timeout);
      });
    });

    this.addTask.bind(this);
    this.setWorker.bind(this);
  }

  setWorker(worker) {
    this.worker = worker;
  }

  async addTask(endpoint, endpointDataToPass, consumerType) {
    return this.tasks.push({
      endpoint,
      endpointDataToPass,
      consumerType,
      timeout: null,
    });
  }

  async consume(data, consumerType) {
    console.log(`Consumer: ${consumerType}`);
  }

  start() {
    this.emit("start");
  }
}

const api = new ApiServer();
const queue = new Queue();

queue.setWorker((props) => api.callApi(props));

queue.addTask(1, { data: 1 }, 1);
queue.addTask(2, { data: 2 }, 2);
queue.addTask(3, { data: 3 }, 3);
queue.addTask(1, { data: 1 }, 1);
queue.addTask(4, { data: 4 }, 4);
queue.addTask(2, { data: 2 }, 2);
queue.start();
