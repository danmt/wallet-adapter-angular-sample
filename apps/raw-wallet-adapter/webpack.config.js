module.exports = (config) => {
  config.resolve.fallback = {
    crypto: false,
    assert: false,
    stream: false
  };

  return config;
};
