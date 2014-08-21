/**
 * Initializes elasticsearch with our schema. Kind of like Rails's schema.rb, but not autogenerated.
 */
'use strict';

var bluebird = require('bluebird');
var conf = require('../conf');
var logger = conf.logger;
var addPaperTrail = require('../caper-trail').mapping;
var client = conf.elasticsearch.newClient();

// TODO timestamp indices and create aliases

// List of requests to make to elasticsearch. Note to future maintainers: try to keep this sorted alphabetically
var indexRequests = [
  function dashboard (callback) {
    client.indices.create({
      index: 'dashboard',
      body: {
        mappings: {
          dashboard: addPaperTrail({
            properties: {
              name: {
                type: 'string',
                index: 'not_analyzed'
              },
              description: {
                type: 'string',
                index: 'not_analyzed'
              }
            }
          })
        }
      }
    }, callback);
  },

  /**
   * Holds a single record containing the last time we date shifted. Necessary so date shifting doesn't compound.
   */
  function dateShift (callback) {
    client.indices.create({
      index: 'date-shift',
      body: {
        mappings: {
          shift: { // no paper trail required
            properties: {
              date: {
                type: 'date'
              }
            }
          }
        }
      }
    }, callback);
  },

  function diagnosis (callback) {
    client.indices.create({
      index: 'diagnosis', // don't use model b/c that's kind of a circular dependency (and not what Rails does)
      body: {
        mappings: {
          diagnosis: addPaperTrail({
            properties: {
              name: {
                type: 'string',
                fields: {
                  raw: {
                    type: 'string',
                    index: 'not_analyzed'
                  }
                }
              },

              /**
               * True if this diagnosis is being collected.
               */
              enabled: {
                type: 'boolean'
              }
            }
          })
        }
      }
    }, callback);
  },

  function dischargeType (callback) {
    client.indices.create({
      index: 'discharge_type',
      body: {
        mappings: {
          'discharge_type': addPaperTrail({
            properties: {
              name: {
                type: 'string',
                fields: {
                  raw: {
                    type: 'string',
                    index: 'not_analyzed'
                  }
                }
              }
            }
          })
        }
      }
    }, callback);
  },

  function district (callback) {
    client.indices.create({
      index: 'region', // not 'district' so that other geographic units can be tracked, hopefully we don't regret this
      body: {
        mappings: {
          district: addPaperTrail({
            properties: {
              name: {
                type: 'string',
                fields: {
                  raw: {
                    type: 'string',
                    index: 'not_analyzed'
                  }
                }
              },
              geometry: {
                type: 'geo_shape'
              }
            }
          })
        }
      }
    }, callback);
  },

  function outpatient (callback) {
    client.indices.create({
      index: 'outpatient',
      body: {
        settings: {
          analysis: {
            analyzer: {
              // allow searching on sex=female or sex=f
              sex: {
                tokenizer: 'whitespace',
                filter: ['lowercase', 'sex']
              }
            },
            filter: {
              sex: {
                type: 'synonym',
                synonyms: [
                  'm => male',
                  'f => female'
                ]
              }
            }
          }
        },
        mappings: {
          visit: addPaperTrail({
            properties: {
              reportDate: {
                type: 'date'
              },

              // AKA presenting problem, Reason for Encounter, Reason for Presenting, etc. Free text
              notes: {
                type: 'string'
              },

              // Array of well-known symptoms that the patient presented with. Might be populated by parsing
              // notes, or might be used instead of notes. Used for syndromic surveillance.
              symptoms: {
                properties: {
                  // name of the symptom, e.g. Back Pain
                  name: {
                    type: 'string',
                    fields: {
                      raw: {
                        type: 'string',
                        index: 'not_analyzed'
                      }
                    }
                  },

                  // How many cases presented with this symptom. Used for aggregate reporting. For individual reporting,
                  // this will be 1.
                  count: {
                    type: 'integer'
                  }
                }
              },

              visitType: {
                type: 'string',
                index: 'not_analyzed'
              },

              discharge: {
                type: 'string',
                index: 'not_analyzed'
              },

              // Array of well-known diagnoses. Usually used with symptoms.
              diagnoses: {
                properties: {
                  // name of the diagnosis, e.g. Anemia
                  name: {
                    type: 'string',
                    fields: {
                      raw: {
                        type: 'string',
                        index: 'not_analyzed'
                      }
                    }
                  },

                  // How many cases presented with this diagnosis. Used for aggregate reporting. For individual
                  // reporting, this will be 1.
                  count: {
                    type: 'integer'
                  }
                }
              },

              // Syndromes are high-level groupings useful for surveillance, for example, "Dental." They are often
              // related to symptoms.
              syndromes: {
                properties: {
                  // name of the syndrome, e.g. Eye Disease
                  name: {
                    type: 'string',
                    fields: {
                      raw: {
                        type: 'string',
                        index: 'not_analyzed'
                      }
                    }
                  },

                  // How many cases presented with this syndrome. Used for aggregate reporting. For individual
                  // reporting, this will be 1.
                  count: {
                    type: 'integer'
                  }
                }
              },

              patient: {
                properties: {
                  _id: {
                    type: 'integer',
                    index: 'not_analyzed'
                  },
                  age: {
                    // we don't need that much precision, but we do want to support fractional ages, e.g. 0.5
                    type: 'double'
                  },
                  sex: {
                    type: 'string',
                    analyzer: 'sex'
                  },
                  weight: {
                    // Note that we do not store units, e.g. lb or kg. It's up to the application to make sure every
                    // entry uses the same units.
                    type: 'double'
                  },

                  // TODO move all this under vitals? could be useful if we split it out as separate addon
                  temperature: {
                    type: 'double'
                  },
                  pulse: {
                    type: 'double'
                  },
                  bloodPressure: {
                    properties: {
                      diastolic: {
                        type: 'double'
                      },
                      systolic: {
                        type: 'double'
                      }
                    }
                  }
                }
              },

              // AKA the clinic, hospital, military treatment center, etc. where the patient was processed.
              // Why medicalFacility? Because that's what http://en.wikipedia.org/wiki/Medical_facility says.
              medicalFacility: {
                properties: {

                  // The name of this facility
                  name: {
                    type: 'string'
                  },

                  // The administrative subdivision of this facility. Could be state, county, school district, etc.
                  district: {
                    type: 'string',
                    fields: {
                      raw: {
                        type: 'string',
                        index: 'not_analyzed'
                      }
                    }
                  },
                  sites: {
                    properties: {
                      total: {
                        type: 'integer'
                      },
                      reporting: {
                        type: 'integer'
                      }
                    }
                  }
                }
              }
            }
          })
        }
      }
    }, callback);
  },

  function symptom (callback) {
    client.indices.create({
      index: 'symptom',
      body: {
        mappings: {
          symptom: addPaperTrail({
            properties: {
              name: {
                type: 'string',
                fields: {
                  raw: {
                    type: 'string',
                    index: 'not_analyzed'
                  }
                }
              },

              /**
               * True if this symptom is being collected.
               */
              enabled: {
                type: 'boolean'
              }
            }
          })
        }
      }
    }, callback);
  },

  function syndrome (callback) {
    client.indices.create({
      index: 'syndrome',
      body: {
        mappings: {
          syndrome: addPaperTrail({
            properties: {
              name: {
                type: 'string',
                fields: {
                  raw: {
                    type: 'string',
                    index: 'not_analyzed'
                  }
                }
              },

              /**
               * True if this syndrome is being collected.
               */
              enabled: {
                type: 'boolean'
              }
            }
          })
        }
      }
    }, callback);
  },

  function user (callback) {
    client.indices.create({
      index: 'user',
      body: {
        mappings: {
          user: addPaperTrail({
            properties: {
              username: {
                type: 'string',
                fields: {
                  raw: {
                    type: 'string',
                    index: 'not_analyzed'
                  }
                }
              },
              email: {
                type: 'string',
                index: 'not_analyzed'
              },
              password: {
                type: 'string',
                index: 'not_analyzed'
              },
              name: {
                type: 'string',
                index: 'not_analyzed'
              },
              disabled: {
                type: 'boolean'
              },
              roles: {
                type: 'string',
                fields: {
                  raw: {
                    type: 'string',
                    index: 'not_analyzed'
                  }
                }
              },
              districts: {
                type: 'string',
                fields: {
                  raw: {
                    type: 'string',
                    index: 'not_analyzed'
                  }
                }
              }
            }
          })
        }
      }
    }, callback);
  },

  function visitType (callback) {
    client.indices.create({
      index: 'visit_type',
      body: {
        mappings: {
          'visit_type': addPaperTrail({
            properties: {
              name: {
                type: 'string',
                fields: {
                  raw: {
                    type: 'string',
                    index: 'not_analyzed'
                  }
                }
              }
            }
          })
        }
      }
    }, callback);
  },

  function visualization (callback) {
    client.indices.create({
      index: 'visualization',
      body: {
        mappings: {
          visualization: addPaperTrail({
            properties: {
              name: {
                type: 'string',
                fields: {
                  raw: {
                    type: 'string',
                    index: 'not_analyzed'
                  }
                }
              },
              state: {
                type: 'object'
              }
            }
          })
        }
      }
    }, callback);
  },

  function workbench (callback) {
    client.indices.create({
      index: 'workbench',
      body: {
        mappings: {
          workbench: addPaperTrail({
            properties: {
              name: {
                type: 'string',
                fields: {
                  raw: {
                    type: 'string',
                    index: 'not_analyzed'
                  }
                }
              },
              state: {
                type: 'object'
              }
            }
          })
        }
      }
    }, callback);
  }
];

bluebird.settle(indexRequests.map(function (ir) {
    return bluebird.promisify(ir)();
  }))
  .then(function (promiseInspections) {
    var errors = promiseInspections.filter(function (pi) {
      return pi.isRejected();
    }).map(function (pi) {
      return pi.error();
    });

    errors.forEach(function (e) {
      logger.error({err: e}, 'Error creating index');
    });

    var numSuccesses = indexRequests.length - errors.length;
    logger.info('Successfully created %d out of %d indices (%d errors)', numSuccesses, indexRequests.length,
      errors.length);
  })
  .catch(function (e) {
    // this shouldn't ever happen, but in case it does we don't want to swallow errors
    logger.error({err: e}, 'Error creating indices');
  })
  .finally(function () {
    client.close();
  });
