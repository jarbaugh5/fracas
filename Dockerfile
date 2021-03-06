###############################################################################
# Dockerfile for Fracas
###############################################################################

# We could probably get the resulting image smaller if we cut out some of the cruft from the node image, but that's a
# lot of work
FROM node

MAINTAINER Gabe Gorelick, "https://github.com/gabegorelick"

RUN mkdir /code
WORKDIR /code

ADD package.json /code/package.json
RUN npm install --production

ADD server /code/server
ADD server.js /code/server.js

# Make sure you run a build first!
ADD dist /code/dist

EXPOSE 9000 9001
ENV NODE_ENV production

# still need to do some work to get phantom working
ENV PHANTOM false

CMD ["node", "/code/server.js"]
