/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

import React, { useState, useCallback, useEffect } from "react";
import { Localized } from "./MSLocalized";
import { AboutWelcomeUtils } from "../../lib/aboutwelcome-utils";
import { addUtmParams } from "../../asrouter/templates/FirstRun/addUtmParams";

export const MultiStageAboutWelcome = props => {
  const [index, setScreenIndex] = useState(0);
  useEffect(() => {
    // Send impression ping when respective screen first renders
    props.screens.forEach(screen => {
      if (index === screen.order) {
        AboutWelcomeUtils.sendImpressionTelemetry(
          `${props.message_id}_${screen.id}`
        );
      }
    });
  }, [index]);

  const [flowParams, setFlowParams] = useState(null);
  const { metricsFlowUri } = props;
  useEffect(() => {
    (async () => {
      if (metricsFlowUri) {
        setFlowParams(await AboutWelcomeUtils.fetchFlowParams(metricsFlowUri));
      }
    })();
  }, [metricsFlowUri]);

  // Transition to next screen, opening about:home on last screen button CTA
  const handleTransition =
    index < props.screens.length
      ? useCallback(() => setScreenIndex(prevState => prevState + 1), [])
      : AboutWelcomeUtils.handleUserAction({
          type: "OPEN_ABOUT_PAGE",
          data: { args: "home", where: "current" },
        });

  const [topSites] = useState([
    "resource://activity-stream/data/content/tippytop/images/youtube-com@2x.png",
    "resource://activity-stream/data/content/tippytop/images/facebook-com@2x.png",
    "resource://activity-stream/data/content/tippytop/images/amazon@2x.png",
    "resource://activity-stream/data/content/tippytop/images/reddit-com@2x.png",
    "resource://activity-stream/data/content/tippytop/images/wikipedia-org@2x.png",
    "resource://activity-stream/data/content/tippytop/images/twitter-com@2x.png",
  ]);

  return (
    <React.Fragment>
      <div className={`multistageContainer`}>
        {props.screens.map(screen => {
          return index === screen.order ? (
            <WelcomeScreen
              id={screen.id}
              totalNumberOfScreens={props.screens.length}
              order={screen.order}
              content={screen.content}
              navigate={handleTransition}
              topSites={topSites}
              messageId={`${props.message_id}_${screen.id}`}
              UTMTerm={props.utm_term}
              flowParams={flowParams}
            />
          ) : null;
        })}
      </div>
    </React.Fragment>
  );
};

export class WelcomeScreen extends React.PureComponent {
  constructor(props) {
    super(props);
    this.handleAction = this.handleAction.bind(this);
  }

  handleOpenURL(action, flowParams, UTMTerm) {
    let { type, data } = action;
    let url = new URL(data.args);
    addUtmParams(url, `aboutwelcome-${UTMTerm}-screen`);

    if (action.addFlowParams && flowParams) {
      url.searchParams.append("device_id", flowParams.deviceId);
      url.searchParams.append("flow_id", flowParams.flowId);
      url.searchParams.append("flow_begin_time", flowParams.flowBeginTime);
    }

    data = { ...data, args: url.toString() };
    AboutWelcomeUtils.handleUserAction({ type, data });
  }

  async handleAction(event) {
    let { props } = this;
    let targetContent = props.content[event.target.value];
    if (!(targetContent && targetContent.action)) {
      return;
    }

    // Send telemetry before waiting on actions
    AboutWelcomeUtils.sendActionTelemetry(props.messageId, event.target.value);

    let { action } = targetContent;
    if (action.type === "OPEN_URL") {
      this.handleOpenURL(action, props.flowParams, props.UTMTerm);
    } else if (action.type) {
      AboutWelcomeUtils.handleUserAction(action);
      // Wait until migration closes to complete the action
      if (action.type === "SHOW_MIGRATION_WIZARD") {
        await window.AWWaitForMigrationClose();
        AboutWelcomeUtils.sendActionTelemetry(props.messageId, "migrate_close");
      }
    }

    if (action.navigate) {
      props.navigate();
    }
  }

  renderSecondaryCTA(className) {
    return (
      <div className={`secondary-cta ${className}`}>
        <Localized text={this.props.content.secondary_button.text}>
          <span />
        </Localized>
        <Localized text={this.props.content.secondary_button.label}>
          <button
            className="secondary"
            value="secondary_button"
            onClick={this.handleAction}
          />
        </Localized>
      </div>
    );
  }

  renderTiles() {
    return this.props.content.tiles && this.props.topSites ? (
      <div className="tiles-section">
        {this.props.topSites.slice(0, 5).map(icon => (
          <div
            className="icon"
            key={icon}
            style={{ backgroundImage: `url(${icon})` }}
          />
        ))}
      </div>
    ) : null;
  }

  renderStepsIndicator() {
    let steps = [];
    for (let i = 0; i < this.props.totalNumberOfScreens; i++) {
      let className = i === this.props.order ? "current" : "";
      steps.push(<div key={i} className={`indicator ${className}`} />);
    }
    return steps;
  }

  render() {
    const { content } = this.props;
    const hasSecondaryTopCTA =
      content.secondary_button && content.secondary_button.position === "top";
    return (
      <main className={`screen ${this.props.id}`}>
        {hasSecondaryTopCTA ? this.renderSecondaryCTA("top") : null}
        <div className={`brand-logo ${hasSecondaryTopCTA ? "cta-top" : ""}`} />
        <div className="welcome-text">
          <Localized text={content.title}>
            <h1 />
          </Localized>
          <Localized text={content.subtitle}>
            <h2 />
          </Localized>
        </div>
        {content.tiles ? this.renderTiles() : null}
        <div>
          <Localized
            text={content.primary_button ? content.primary_button.label : null}
          >
            <button
              className="primary"
              value="primary_button"
              onClick={this.handleAction}
            />
          </Localized>
        </div>
        {content.secondary_button && content.secondary_button.position !== "top"
          ? this.renderSecondaryCTA()
          : null}
        <div className="steps">{this.renderStepsIndicator()}</div>
      </main>
    );
  }
}
