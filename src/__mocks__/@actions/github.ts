export const context = {
  eventName: "pull_request",
  repo: {
    owner: "test-owner",
    repo: "test-repo",
  },
  issue: {
    owner: "test-owner",
    repo: "test-repo",
    number: 1,
  },
  payload: {},
};

export const getOctokit = jest.fn();
